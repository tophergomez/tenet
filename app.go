package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"tenet/core/auth"
	"tenet/core/config"
	"tenet/core/db"
	"tenet/core/directory"
	"tenet/core/models"
	"tenet/core/session"
	"tenet/core/terminal"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ─── DTOs ────────────────────────────────────────────────────────────────────

type UserDTO struct {
	ID     string `json:"id"`
	Email  string `json:"email"`
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
}

type SessionDTO struct {
	ID         string       `json:"id"`
	Name       string       `json:"name"`
	Shell      string       `json:"shell"`
	WorkingDir string       `json:"working_dir"`
	CreatedAt  time.Time    `json:"created_at"`
	LastUsedAt time.Time    `json:"last_used_at"`
	Commands   []CommandDTO `json:"commands,omitempty"`
}

type CommandDTO struct {
	ID         string    `json:"id"`
	Input      string    `json:"input"`
	Output     string    `json:"output"`
	ExitCode   int       `json:"exit_code"`
	DurationMs int64     `json:"duration_ms"`
	WorkingDir string    `json:"working_dir"`
	CreatedAt  time.Time `json:"created_at"`
}

type AppStatusDTO struct {
	DBConnected     bool     `json:"db_connected"`
	OAuthConfigured bool     `json:"oauth_configured"`
	CurrentUser     *UserDTO `json:"current_user,omitempty"`
}

// ─── App ─────────────────────────────────────────────────────────────────────

type App struct {
	ctx         context.Context
	config      *config.Config
	oauth       *auth.OAuthManager
	termManager *terminal.Manager
	sessionSvc  *session.Service
	currentUser *models.User
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	config.Load()
	a.config = config.App

	// Database (optional — app works without it)
	if a.config.DatabaseURL != "" {
		if err := db.Connect(a.config.DatabaseURL); err != nil {
			runtime.LogErrorf(ctx, "DB connect failed: %v", err)
		}
	}

	// OAuth manager
	if a.config.GoogleClientID != "" {
		a.oauth = auth.NewOAuthManager(
			a.config.GoogleClientID,
			a.config.GoogleClientSecret,
			a.config.OAuthCallbackPort,
		)
	}

	// Terminal manager
	a.termManager = terminal.NewManager(ctx)

	// Session service (userID set after login)
	a.sessionSvc = session.NewService(uuid.Nil)

	// Restore persisted session
	if token := a.loadToken(); token != "" {
		if claims, err := auth.ValidateToken(token, a.config.JWTSecret); err == nil {
			a.currentUser = &models.User{
				ID:     claims.UserID,
				Email:  claims.Email,
				Name:   claims.Name,
				Avatar: claims.Avatar,
			}
			a.sessionSvc.SetUser(claims.UserID)
		}
	}
}

func (a *App) shutdown(_ context.Context) {
	if a.termManager != nil {
		a.termManager.CloseAll()
	}
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

// AuthStatus returns the current app state so the frontend can decide what to show.
func (a *App) AuthStatus() AppStatusDTO {
	var user *UserDTO
	if a.currentUser != nil {
		user = &UserDTO{
			ID:     a.currentUser.ID.String(),
			Email:  a.currentUser.Email,
			Name:   a.currentUser.Name,
			Avatar: a.currentUser.Avatar,
		}
	}
	return AppStatusDTO{
		DBConnected:     db.IsConnected(),
		OAuthConfigured: a.config != nil && a.config.GoogleClientID != "",
		CurrentUser:     user,
	}
}

// AuthStartLogin opens a browser to Google OAuth and emits auth:success / auth:error.
func (a *App) AuthStartLogin() error {
	if a.oauth == nil {
		return fmt.Errorf("Google OAuth is not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file")
	}

	authURL, err := a.oauth.StartLogin()
	if err != nil {
		return err
	}

	// Open the system browser
	runtime.BrowserOpenURL(a.ctx, authURL)

	// Wait for callback in the background
	go func() {
		user, err := a.oauth.WaitForUser(5 * time.Minute)
		if err != nil {
			runtime.EventsEmit(a.ctx, "auth:error", err.Error())
			return
		}

		token, err := auth.GenerateToken(user.ID, user.Email, user.Name, user.Avatar, a.config.JWTSecret)
		if err != nil {
			runtime.EventsEmit(a.ctx, "auth:error", err.Error())
			return
		}

		a.saveToken(token)
		a.currentUser = user
		a.sessionSvc.SetUser(user.ID)

		runtime.EventsEmit(a.ctx, "auth:success", UserDTO{
			ID:     user.ID.String(),
			Email:  user.Email,
			Name:   user.Name,
			Avatar: user.Avatar,
		})
	}()

	return nil
}

// AuthLogout clears the stored session.
func (a *App) AuthLogout() {
	a.currentUser = nil
	a.sessionSvc.SetUser(uuid.Nil)
	a.termManager.CloseAll()
	_ = os.Remove(filepath.Join(a.configDir(), "token"))
	runtime.EventsEmit(a.ctx, "auth:logout", nil)
}

// ─── Terminal ─────────────────────────────────────────────────────────────────

// TerminalCreate starts a new shell process and returns its ID.
func (a *App) TerminalCreate(shell, workingDir string) (string, error) {
	if shell == "" {
		shell = terminal.ShellPowerShell
	}
	return a.termManager.Create(shell, workingDir)
}

// TerminalWrite sends raw input to a terminal.
func (a *App) TerminalWrite(termID, data string) error {
	return a.termManager.Write(termID, data)
}

// TerminalResize updates the terminal dimensions.
func (a *App) TerminalResize(termID string, cols, rows int) error {
	return a.termManager.Resize(termID, cols, rows)
}

// TerminalClose terminates a terminal process.
func (a *App) TerminalClose(termID string) {
	a.termManager.Close(termID)
}

// TerminalAvailableShells returns the shells available on this OS.
func (a *App) TerminalAvailableShells() []string {
	return availableShells()
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

func (a *App) requireDB() error {
	if !db.IsConnected() {
		return fmt.Errorf("database not connected — set DATABASE_URL in your .env file")
	}
	return nil
}

func (a *App) requireAuth() error {
	if a.currentUser == nil {
		return fmt.Errorf("not authenticated")
	}
	return nil
}

// SessionList returns all saved sessions for the logged-in user.
func (a *App) SessionList() ([]SessionDTO, error) {
	if err := a.requireDB(); err != nil {
		return nil, err
	}
	if err := a.requireAuth(); err != nil {
		return nil, err
	}
	sessions, err := a.sessionSvc.List()
	if err != nil {
		return nil, err
	}
	result := make([]SessionDTO, len(sessions))
	for i, s := range sessions {
		result[i] = toSessionDTO(s)
	}
	return result, nil
}

// SessionCreate saves a new session entry.
func (a *App) SessionCreate(name, shell, workingDir string) (*SessionDTO, error) {
	if err := a.requireDB(); err != nil {
		return nil, err
	}
	if err := a.requireAuth(); err != nil {
		return nil, err
	}
	s, err := a.sessionSvc.Create(name, shell, workingDir)
	if err != nil {
		return nil, err
	}
	dto := toSessionDTO(*s)
	return &dto, nil
}

// SessionGet returns a session with its command history.
func (a *App) SessionGet(id string) (*SessionDTO, error) {
	if err := a.requireDB(); err != nil {
		return nil, err
	}
	if err := a.requireAuth(); err != nil {
		return nil, err
	}
	s, err := a.sessionSvc.Get(id)
	if err != nil {
		return nil, err
	}
	dto := toSessionDTO(*s)
	return &dto, nil
}

// SessionDelete removes a session.
func (a *App) SessionDelete(id string) error {
	if err := a.requireDB(); err != nil {
		return err
	}
	if err := a.requireAuth(); err != nil {
		return err
	}
	return a.sessionSvc.Delete(id)
}

// SessionRename changes a session's display name.
func (a *App) SessionRename(id, name string) error {
	if err := a.requireDB(); err != nil {
		return err
	}
	if err := a.requireAuth(); err != nil {
		return err
	}
	return a.sessionSvc.Rename(id, name)
}

// SessionAddCommand saves a finished command block to the session history.
func (a *App) SessionAddCommand(sessionID, input, output, workingDir string, exitCode int, durationMs int64) error {
	if err := a.requireDB(); err != nil {
		return err
	}
	return a.sessionSvc.AddCommand(sessionID, input, output, workingDir, exitCode, durationMs)
}

// ─── Directory ────────────────────────────────────────────────────────────────

// DirList returns the entries of a directory.
func (a *App) DirList(path string) ([]directory.Entry, error) {
	return directory.List(path)
}

// DirHome returns the current user's home directory.
func (a *App) DirHome() string {
	return directory.Home()
}

// ─── helpers ──────────────────────────────────────────────────────────────────

func (a *App) configDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".tenet")
}

func (a *App) saveToken(token string) {
	dir := a.configDir()
	_ = os.MkdirAll(dir, 0o700)
	_ = os.WriteFile(filepath.Join(dir, "token"), []byte(token), 0o600)
}

func (a *App) loadToken() string {
	data, err := os.ReadFile(filepath.Join(a.configDir(), "token"))
	if err != nil {
		return ""
	}
	return string(data)
}

func toSessionDTO(s models.TerminalSession) SessionDTO {
	cmds := make([]CommandDTO, len(s.Commands))
	for i, c := range s.Commands {
		cmds[i] = CommandDTO{
			ID:         c.ID.String(),
			Input:      c.Input,
			Output:     c.Output,
			ExitCode:   c.ExitCode,
			DurationMs: c.DurationMs,
			WorkingDir: c.WorkingDir,
			CreatedAt:  c.CreatedAt,
		}
	}
	return SessionDTO{
		ID:         s.ID.String(),
		Name:       s.Name,
		Shell:      string(s.Shell),
		WorkingDir: s.WorkingDir,
		CreatedAt:  s.CreatedAt,
		LastUsedAt: s.LastUsedAt,
		Commands:   cmds,
	}
}