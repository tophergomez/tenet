//go:build windows

package main

import "os/exec"

// availableShells returns the shells detected on this Windows system.
func availableShells() []string {
	shells := []string{"powershell", "cmd"}
	if _, err := exec.LookPath("bash"); err == nil {
		shells = append(shells, "bash")
	}
	return shells
}
