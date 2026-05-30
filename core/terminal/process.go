package terminal

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
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

// CWDHandler is called when the shell reports a new working directory via OSC 7.
type CWDHandler func(termID, dir string)

// Process represents a running shell process.
type Process struct {
	ID         string
	Shell      ShellType
	WorkingDir string

	pty      io.ReadWriteCloser // platform-specific PTY handle
	mu       sync.Mutex
	onOutput OutputHandler
	onCWD    CWDHandler
	onExit   ExitHandler
}

// NewProcess creates and starts a shell process, streaming output via onOutput.
// onCWD is called whenever the shell emits an OSC 7 directory change; may be nil.
func NewProcess(shell, workingDir string, onOutput OutputHandler, onCWD CWDHandler, onExit ExitHandler) (*Process, error) {
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
		onCWD:      onCWD,
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

// readLoop drains the PTY output, fires onOutput, and detects OSC 7 CWD notifications.
func (p *Process) readLoop() {
	p.mu.Lock()
	pty := p.pty
	p.mu.Unlock()
	if pty == nil {
		return
	}

	buf := make([]byte, 32*1024)
	var oscBuf strings.Builder // accumulates a partial OSC sequence across reads
	inOSC := false

	for {
		n, err := pty.Read(buf)
		if n > 0 {
			chunk := string(buf[:n])
			clean, cwd := extractOSC7(chunk, &oscBuf, &inOSC)
			if clean != "" && p.onOutput != nil {
				p.onOutput(p.ID, clean)
			}
			if cwd != "" && p.onCWD != nil {
				p.onCWD(p.ID, cwd)
			}
		}
		if err != nil {
			break
		}
	}
}

// extractOSC7 strips OSC 7 sequences from data, returning the cleaned output
// and the extracted directory path (empty string if none found).
func extractOSC7(data string, buf *strings.Builder, inOSC *bool) (clean, cwd string) {
	var out strings.Builder
	i := 0
	for i < len(data) {
		if *inOSC {
			// Looking for BEL (\x07) or ST (\x1b\\) that terminates the OSC.
			if data[i] == '\x07' {
				cwd = parseOSC7(buf.String())
				buf.Reset()
				*inOSC = false
				i++
				continue
			}
			if data[i] == '\x1b' && i+1 < len(data) && data[i+1] == '\\' {
				cwd = parseOSC7(buf.String())
				buf.Reset()
				*inOSC = false
				i += 2
				continue
			}
			buf.WriteByte(data[i])
			i++
			continue
		}
		// Detect start of OSC sequence: ESC ]
		if data[i] == '\x1b' && i+1 < len(data) && data[i+1] == ']' {
			// Peek at the OSC number
			j := i + 2
			for j < len(data) && data[j] >= '0' && data[j] <= '9' {
				j++
			}
			if j < len(data) && data[j] == ';' {
				numStr := data[i+2 : j]
				if numStr == "7" {
					*inOSC = true
					buf.Reset()
					buf.WriteString("7;")
					i = j + 1 // skip past the ';'
					continue
				}
			}
		}
		out.WriteByte(data[i])
		i++
	}
	return out.String(), cwd
}

// parseOSC7 extracts the path from an OSC 7 payload ("7;file://host/path").
func parseOSC7(payload string) string {
	payload = strings.TrimPrefix(payload, "7;")
	if !strings.HasPrefix(payload, "file://") {
		return ""
	}
	// Strip the scheme and host: file://hostname/path → /path
	rest := payload[len("file://"):]
	slash := strings.IndexByte(rest, '/')
	if slash < 0 {
		return ""
	}
	path := rest[slash:] // starts with /
	// Windows: /C:/Users/... → C:/Users/...
	if len(path) >= 3 && path[1] >= 'A' && path[1] <= 'Z' && path[2] == ':' {
		path = path[1:]
	}
	return path
}

// buildCmd constructs the exec.Cmd for the requested shell.
func buildCmd(shell, workingDir string) (*exec.Cmd, error) {
	var cmd *exec.Cmd

	switch shell {
	case ShellPowerShell:
		if runtime.GOOS == "windows" {
			// Do NOT pass "-Command -" — the bare dash as stdin sentinel is rejected
			// by some PowerShell versions, causing the help page to print and exit.
			// ConPTY provides a virtual console so PS always starts interactively.
			cmd = exec.Command("powershell.exe", "-NoLogo", "-NoExit")
		} else {
			if path, err := exec.LookPath("pwsh"); err == nil {
				cmd = exec.Command(path, "-NoLogo", "-NoExit")
			} else {
				cmd = exec.Command("powershell", "-NoLogo", "-NoExit")
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

// startupScript returns a shell command that installs OSC 7 CWD reporting.
// The result is sent to the PTY after the shell finishes its startup phase.
func startupScript(shell ShellType) string {
	switch shell {
	case ShellBash:
		// Define a helper function and append it to PROMPT_COMMAND so it
		// co-exists with any PROMPT_COMMAND already set in .bashrc.
		return "__tenet_cwd(){ printf '\\033]7;file://localhost%s\\007' \"$PWD\"; };" +
			" PROMPT_COMMAND=\"${PROMPT_COMMAND:+${PROMPT_COMMAND}; }__tenet_cwd\"\n"
	case ShellPowerShell:
		// Override the prompt function to emit OSC 7 before the prompt text.
		// Use $p.Replace('\','/') (String,String overload) — String.Replace(Char,Char)
		// was only added in .NET 5 and is unavailable in Windows PowerShell 5.1 (.NET 4.x).
		// End with \r\n: PSReadLine uses \r (carriage return) as the Enter key on Windows.
		// [char]27 = ESC, [char]7 = BEL
		return "function global:prompt {" +
			" $p=$PWD.Path;" +
			" [Console]::Write([char]27+\"]7;file:///\"+$p.Replace('\\','/')+[char]7);" +
			" \"PS $p> \" }\r\n"
	default:
		return ""
	}
}
