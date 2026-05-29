package terminal

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"sync"

	"github.com/google/uuid"
)

// ShellType identifies the shell the process is running.
type ShellType = string

const (
	ShellBash       ShellType = "bash"
	ShellPowerShell ShellType = "powershell"
	ShellCmd        ShellType = "cmd"
)

// OutputHandler is called with each chunk of terminal output.
type OutputHandler func(termID, data string)

// ExitHandler is called when the process exits.
type ExitHandler func(termID string, exitCode int)

// Process represents a running shell process.
type Process struct {
	ID         string
	Shell      ShellType
	WorkingDir string

	pty      io.ReadWriteCloser // platform-specific PTY handle
	mu       sync.Mutex
	onOutput OutputHandler
	onExit   ExitHandler
}

// NewProcess creates and starts a shell process, streaming output via onOutput.
func NewProcess(shell, workingDir string, onOutput OutputHandler, onExit ExitHandler) (*Process, error) {
	if workingDir == "" {
		home, err := os.UserHomeDir()
		if err == nil {
			workingDir = home
		} else {
			workingDir = "."
		}
	}

	p := &Process{
		ID:         uuid.New().String(),
		Shell:      shell,
		WorkingDir: workingDir,
		onOutput:   onOutput,
		onExit:     onExit,
	}

	if err := p.start(); err != nil {
		return nil, err
	}
	go p.readLoop()
	return p, nil
}

func (p *Process) Write(data string) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.pty == nil {
		return fmt.Errorf("terminal not running")
	}
	_, err := io.WriteString(p.pty, data)
	return err
}

func (p *Process) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.pty != nil {
		p.pty.Close()
		p.pty = nil
	}
}

// readLoop drains the PTY output and fires onOutput.
func (p *Process) readLoop() {
	buf := make([]byte, 4096)
	for {
		n, err := p.pty.Read(buf)
		if n > 0 && p.onOutput != nil {
			p.onOutput(p.ID, string(buf[:n]))
		}
		if err != nil {
			break
		}
	}
}

// buildCmd constructs the exec.Cmd for the requested shell.
func buildCmd(shell, workingDir string) (*exec.Cmd, error) {
	var cmd *exec.Cmd

	switch shell {
	case ShellPowerShell:
		if runtime.GOOS == "windows" {
			cmd = exec.Command("powershell.exe", "-NoLogo", "-NoExit", "-Command", "-")
		} else {
			if path, err := exec.LookPath("pwsh"); err == nil {
				cmd = exec.Command(path, "-NoLogo", "-NoExit", "-Command", "-")
			} else {
				cmd = exec.Command("powershell", "-NoLogo", "-NoExit", "-Command", "-")
			}
		}

	case ShellCmd:
		if runtime.GOOS != "windows" {
			return nil, fmt.Errorf("cmd.exe is only available on Windows")
		}
		cmd = exec.Command("cmd.exe")

	default: // bash
		if runtime.GOOS == "windows" {
			if path, err := exec.LookPath("bash"); err == nil {
				cmd = exec.Command(path, "--login", "-i")
			} else {
				cmd = exec.Command("wsl.exe", "bash", "--login", "-i")
			}
		} else {
			bash, err := exec.LookPath("bash")
			if err != nil {
				bash = "/bin/bash"
			}
			cmd = exec.Command(bash, "--login", "-i")
		}
	}

	cmd.Dir = workingDir
	cmd.Env = append(os.Environ(),
		"TERM=xterm-256color",
		"COLORTERM=truecolor",
	)
	return cmd, nil
}
