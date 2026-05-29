//go:build !windows

package terminal

import (
	"os"
	"syscall"

	"github.com/creack/pty"
)

// unixPty wraps an *os.File (the PTY master) as io.ReadWriteCloser.
type unixPty struct {
	f    *os.File
	size *pty.Winsize
}

func (u *unixPty) Read(p []byte) (int, error)  { return u.f.Read(p) }
func (u *unixPty) Write(p []byte) (int, error) { return u.f.Write(p) }
func (u *unixPty) Close() error                { return u.f.Close() }

// start launches the shell inside a Unix PTY.
func (p *Process) start() error {
	cmd, err := buildCmd(p.Shell, p.WorkingDir)
	if err != nil {
		return err
	}

	ws := &pty.Winsize{Cols: 220, Rows: 50}
	ptmx, err := pty.StartWithSize(cmd, ws)
	if err != nil {
		return err
	}

	up := &unixPty{f: ptmx, size: ws}
	p.pty = up

	// Wait for exit in background, then fire onExit.
	go func() {
		state, _ := cmd.Process.Wait()
		exitCode := 0
		if state != nil {
			if ws, ok := state.Sys().(syscall.WaitStatus); ok {
				exitCode = ws.ExitStatus()
			}
		}
		if p.onExit != nil {
			p.onExit(p.ID, exitCode)
		}
	}()

	return nil
}

// Resize changes the terminal size on Unix.
func (p *Process) Resize(cols, rows int) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.pty == nil {
		return nil
	}
	up := p.pty.(*unixPty)
	up.size = &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)}
	return pty.Setsize(up.f, up.size)
}
