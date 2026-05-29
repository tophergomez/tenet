package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID        uuid.UUID        `gorm:"type:uuid;primaryKey"                      json:"id"`
	GoogleID  string           `gorm:"uniqueIndex;not null"                       json:"google_id"`
	Email     string           `gorm:"uniqueIndex;not null"                       json:"email"`
	Name      string           `                                                  json:"name"`
	Avatar    string           `                                                  json:"avatar"`
	CreatedAt time.Time        `                                                  json:"created_at"`
	UpdatedAt time.Time        `                                                  json:"updated_at"`
	Sessions  []TerminalSession `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"sessions,omitempty"`
}

func (u *User) BeforeCreate(_ *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
