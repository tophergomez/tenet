package db

import (
	"tenet/core/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// Connect opens a PostgreSQL connection and auto-migrates all models.
func Connect(dsn string) error {
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return err
	}

	return DB.AutoMigrate(
		&models.User{},
		&models.TerminalSession{},
		&models.Command{},
	)
}

// IsConnected reports whether a database connection is established.
func IsConnected() bool {
	return DB != nil
}
