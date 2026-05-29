package session

import (
	"fmt"
	"time"

	"tenet/core/db"
	"tenet/core/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	userID uuid.UUID
}

func NewService(userID uuid.UUID) *Service {
	return &Service{userID: userID}
}

// SetUser switches the active user (called after login/token reload).
func (s *Service) SetUser(userID uuid.UUID) {
	s.userID = userID
}

// List returns all sessions for the current user, newest first.
func (s *Service) List() ([]models.TerminalSession, error) {
	var sessions []models.TerminalSession
	err := db.DB.Where("user_id = ?", s.userID).
		Order("last_used_at DESC").
		Find(&sessions).Error
	return sessions, err
}

// Create inserts a new session.
func (s *Service) Create(name, shell, workingDir string) (*models.TerminalSession, error) {
	sess := &models.TerminalSession{
		UserID:     s.userID,
		Name:       name,
		Shell:      models.ShellType(shell),
		WorkingDir: workingDir,
		LastUsedAt: time.Now(),
	}
	if err := db.DB.Create(sess).Error; err != nil {
		return nil, err
	}
	return sess, nil
}

// Get returns a single session with its command history.
func (s *Service) Get(id string) (*models.TerminalSession, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid session id: %w", err)
	}

	var sess models.TerminalSession
	err = db.DB.
		Preload("Commands", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("created_at ASC").Limit(500)
		}).
		Where("id = ? AND user_id = ?", uid, s.userID).
		First(&sess).Error
	return &sess, err
}

// Rename changes the session display name.
func (s *Service) Rename(id, name string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("invalid session id: %w", err)
	}
	return db.DB.Model(&models.TerminalSession{}).
		Where("id = ? AND user_id = ?", uid, s.userID).
		Update("name", name).Error
}

// Delete removes a session (and its commands via CASCADE).
func (s *Service) Delete(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("invalid session id: %w", err)
	}
	return db.DB.
		Where("id = ? AND user_id = ?", uid, s.userID).
		Delete(&models.TerminalSession{}).Error
}

// Touch updates last_used_at.
func (s *Service) Touch(id string) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return
	}
	db.DB.Model(&models.TerminalSession{}).
		Where("id = ?", uid).
		Update("last_used_at", time.Now())
}

// AddCommand appends a command record to a session.
func (s *Service) AddCommand(sessionID, input, output, workingDir string, exitCode int, durationMs int64) error {
	sid, err := uuid.Parse(sessionID)
	if err != nil {
		return fmt.Errorf("invalid session id: %w", err)
	}
	cmd := &models.Command{
		SessionID:  sid,
		Input:      input,
		Output:     output,
		ExitCode:   exitCode,
		DurationMs: durationMs,
		WorkingDir: workingDir,
	}
	return db.DB.Create(cmd).Error
}
