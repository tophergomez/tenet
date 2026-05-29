package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ShellType string

const (
	ShellBash       ShellType = "bash"
	ShellPowerShell ShellType = "powershell"
	ShellCmd        ShellType = "cmd"
)

type TerminalSession struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey"                        json:"id"`
	UserID     uuid.UUID `gorm:"type:uuid;not null;index"                    json:"user_id"`
	Name       string    `gorm:"not null"                                    json:"name"`
	Shell      ShellType `gorm:"not null;default:'powershell'"               json:"shell"`
	WorkingDir string    `                                                   json:"working_dir"`
	CreatedAt  time.Time `                                                   json:"created_at"`
	UpdatedAt  time.Time `                                                   json:"updated_at"`
	LastUsedAt time.Time `                                                   json:"last_used_at"`
	Commands   []Command `gorm:"foreignKey:SessionID;constraint:OnDelete:CASCADE" json:"commands,omitempty"`
}

func (s *TerminalSession) BeforeCreate(_ *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}
