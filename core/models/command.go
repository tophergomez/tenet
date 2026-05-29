package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Command struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	SessionID  uuid.UUID `gorm:"type:uuid;not null;index" json:"session_id"`
	Input      string    `gorm:"type:text" json:"input"`
	Output     string    `gorm:"type:text" json:"output"`
	ExitCode   int       `json:"exit_code"`
	DurationMs int64     `json:"duration_ms"`
	WorkingDir string    `json:"working_dir"`
	CreatedAt  time.Time `json:"created_at"`
}

func (c *Command) BeforeCreate(_ *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
