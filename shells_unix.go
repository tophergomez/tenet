//go:build !windows

package main

import "os/exec"

// availableShells returns the shells detected on this Unix system.
func availableShells() []string {
	candidates := []string{"bash", "zsh", "fish", "sh"}
	var found []string
	for _, s := range candidates {
		if _, err := exec.LookPath(s); err == nil {
			found = append(found, s)
		}
	}
	if len(found) == 0 {
		return []string{"bash"}
	}
	return found
}
