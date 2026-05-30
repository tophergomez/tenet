package auth

import (
	"context"
	"errors"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"tenet/core/db"
	"tenet/core/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GoogleUser is the response from Google's userinfo endpoint.
type GoogleUser struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

// OAuthManager handles the Google OAuth flow using a fixed local callback port.
type OAuthManager struct {
	clientID     string
	clientSecret string
	port         int
	state        string
	resultChan   chan *models.User
	errChan      chan error
	server       *http.Server
}

func (m *OAuthManager) sendErr(err error) {
	if err == nil {
		return
	}
	select {
	case m.errChan <- err:
	default:
	}
}

func (m *OAuthManager) sendResult(user *models.User) {
	if user == nil {
		return
	}
	select {
	case m.resultChan <- user:
	default:
	}
}

func NewOAuthManager(clientID, clientSecret string, port int) *OAuthManager {
	return &OAuthManager{
		clientID:     clientID,
		clientSecret: clientSecret,
		port:         port,
		resultChan:   make(chan *models.User, 1),
		errChan:      make(chan error, 1),
	}
}

// StartLogin starts the local callback server and returns the Google auth URL.
func (m *OAuthManager) StartLogin() (string, error) {
	m.resultChan = make(chan *models.User, 1)
	m.errChan = make(chan error, 1)
	m.state = uuid.New().String()

	redirectURL := fmt.Sprintf("http://127.0.0.1:%d/callback", m.port)

	cfg := &oauth2.Config{
		ClientID:     m.clientID,
		ClientSecret: m.clientSecret,
		RedirectURL:  redirectURL,
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}

	authURL := cfg.AuthCodeURL(m.state, oauth2.AccessTypeOnline)

	go m.serveCallback(cfg)

	return authURL, nil
}

func (m *OAuthManager) serveCallback(cfg *oauth2.Config) {
	defer func() {
		if r := recover(); r != nil {
			m.sendErr(fmt.Errorf("oauth callback server panic: %v", r))
		}
	}()

	mux := http.NewServeMux()
	m.server = &http.Server{
		Addr:         fmt.Sprintf("127.0.0.1:%d", m.port),
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				http.Error(w, "Internal error", http.StatusInternalServerError)
				m.sendErr(fmt.Errorf("oauth callback panic: %v", rec))
				if m.server != nil {
					go m.server.Shutdown(context.Background()) //nolint:errcheck
				}
			}
		}()

		if r.URL.Query().Get("state") != m.state {
			http.Error(w, "Invalid state parameter", http.StatusBadRequest)
			m.sendErr(fmt.Errorf("invalid OAuth state"))
			go m.server.Shutdown(context.Background()) //nolint:errcheck
			return
		}

		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "Missing authorization code", http.StatusBadRequest)
			m.sendErr(fmt.Errorf("no authorization code in callback"))
			go m.server.Shutdown(context.Background()) //nolint:errcheck
			return
		}

		token, err := cfg.Exchange(context.Background(), code)
		if err != nil {
			http.Error(w, "Token exchange failed", http.StatusInternalServerError)
			m.sendErr(fmt.Errorf("token exchange: %w", err))
			go m.server.Shutdown(context.Background()) //nolint:errcheck
			return
		}

		gu, err := fetchGoogleUser(cfg, token)
		if err != nil {
			http.Error(w, "Failed to retrieve user info", http.StatusInternalServerError)
			m.sendErr(fmt.Errorf("fetch google user: %w", err))
			go m.server.Shutdown(context.Background()) //nolint:errcheck
			return
		}

		user, err := upsertUser(gu)
		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			m.sendErr(fmt.Errorf("upsert user: %w", err))
			go m.server.Shutdown(context.Background()) //nolint:errcheck
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, successPage)

		m.sendResult(user)
		go m.server.Shutdown(context.Background()) //nolint:errcheck
	})

	// Ignore ErrServerClosed — expected on graceful shutdown.
	if err := m.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		m.sendErr(fmt.Errorf("callback server: %w", err))
	}
}

// WaitForUser blocks until OAuth completes or the timeout elapses.
func (m *OAuthManager) WaitForUser(timeout time.Duration) (*models.User, error) {
	select {
	case user := <-m.resultChan:
		return user, nil
	case err := <-m.errChan:
		return nil, err
	case <-time.After(timeout):
		if m.server != nil {
			m.server.Shutdown(context.Background()) //nolint:errcheck
		}
		return nil, fmt.Errorf("OAuth login timed out after %s", timeout)
	}
}

func fetchGoogleUser(cfg *oauth2.Config, token *oauth2.Token) (*GoogleUser, error) {
	client := cfg.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var gu GoogleUser
	if err := json.NewDecoder(resp.Body).Decode(&gu); err != nil {
		return nil, err
	}
	return &gu, nil
}

func upsertUser(gu *GoogleUser) (*models.User, error) {
	if !db.IsConnected() || db.DB == nil {
		return nil, fmt.Errorf("database not connected")
	}

	var user models.User
	res := db.DB.Where("google_id = ?", gu.ID).First(&user)
	if res.Error != nil {
		if !errors.Is(res.Error, gorm.ErrRecordNotFound) {
			return nil, res.Error
		}
		// New user
		user = models.User{
			GoogleID: gu.ID,
			Email:    gu.Email,
			Name:     gu.Name,
			Avatar:   gu.Picture,
		}
		return &user, db.DB.Create(&user).Error
	}
	// Update existing
	db.DB.Model(&user).Updates(models.User{Name: gu.Name, Avatar: gu.Picture})
	return &user, nil
}

const successPage = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Tenet — Login successful</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#09090b;color:#fafafa;font-family:system-ui,sans-serif;
       display:flex;align-items:center;justify-content:center;height:100vh}
  .card{text-align:center;padding:2rem}
  h2{font-size:1.5rem;font-weight:600;margin-bottom:.5rem}
  p{color:#a1a1aa;font-size:.9rem}
  .check{font-size:3rem;margin-bottom:1rem}
</style></head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h2>Login successful</h2>
    <p>You can close this window and return to Tenet.</p>
  </div>
</body>
</html>`
