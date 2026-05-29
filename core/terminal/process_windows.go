//go:build windows

package terminal

import (
	"context"
	"fmt"
	"os"
	"strings"

	conpty "github.com/UserExistsError/conpty"
)

// conPtyWrapper adapts *conpty.ConPty to io.ReadWriteCloser.
type conPtyWrapper struct {
	cpty *conpty.ConPty
}

func (w *conPtyWrapper) Read(p []byte) (int, error)  { return w.cpty.Read(p) }
func (w *conPtyWrapper) Write(p []byte) (int, error) { return w.cpty.Write(p) }
func (w *conPtyWrapper) Close() error                { return w.cpty.Close() }

// start launches the shell inside a Windows ConPTY.
func (p *Process) start() error {
	cmd, err := buildCmd(p.Shell, p.WorkingDir)
	if err != nil {
		return err
	}

	// Build command-line string (ConPty takes a flat string, not []string).
	parts := make([]string, 0, len(cmd.Args))
	for _, arg := range cmd.Args {
		if strings.ContainsAny(arg, " \t") {
			parts = append(parts, `"`+arg+`"`)
		} else {
			parts = append(parts, arg)
		}
	}
	cmdLine := strings.Join(parts, " ")

	home, _ := os.UserHomeDir()
	workDir := p.WorkingDir
	if workDir == "" {
		workDir = home
	}

	cpty, err := conpty.Start(
		cmdLine,
		conpty.ConPtyDimensions(220, 50),
		conpty.ConPtyWorkDir(workDir),
		conpty.ConPtyEnv(cmd.Env),
	)
	if err != nil {
		return fmt.Errorf("conpty start %q: %w", cmdLine, err)
	}

	p.pty = &conPtyWrapper{cpty: cpty}

	// Wait for exit in background, then fire onExit.
	go func() {
		code, _ := cpty.Wait(context.Background())
		if p.onExit != nil {
			p.onExit(p.ID, int(code))
		}
	}()

	return nil
}

// Resize resizes the ConPTY window.
func (p *Process) Resize(cols, rows int) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.pty == nil {
		return nil
	}
	w := p.pty.(*conPtyWrapper)
	return w.cpty.Resize(cols, rows)
}

