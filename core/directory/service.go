package directory

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Entry represents a file or directory.
type Entry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"is_dir"`
	Size  int64  `json:"size"`
	Mode  string `json:"mode"`
}

// List returns the contents of a directory, dirs first then files.
func List(path string) ([]Entry, error) {
	path = expand(path)

	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	result := make([]Entry, 0, len(entries))
	for _, e := range entries {
		// Skip hidden entries on all platforms
		if strings.HasPrefix(e.Name(), ".") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		full := filepath.Join(path, e.Name())
		result = append(result, Entry{
			Name:  e.Name(),
			Path:  full,
			IsDir: e.IsDir(),
			Size:  info.Size(),
			Mode:  info.Mode().String(),
		})
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].IsDir != result[j].IsDir {
			return result[i].IsDir
		}
		return strings.ToLower(result[i].Name) < strings.ToLower(result[j].Name)
	})

	return result, nil
}

// Home returns the current user's home directory.
func Home() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "."
	}
	return home
}

// Expand replaces a leading ~ with the home directory.
func expand(path string) string {
	if path == "~" {
		return Home()
	}
	if strings.HasPrefix(path, "~/") || strings.HasPrefix(path, `~\`) {
		return filepath.Join(Home(), path[2:])
	}
	return path
}
