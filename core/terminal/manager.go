package terminal

import (
	"context"
	"fmt"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Manager tracks all live terminal processes and streams their output
// to the Wails frontend via events.
type Manager struct {
	ctx       context.Context
	processes map[string]*Process
	mu        sync.RWMutex
}

func NewManager(ctx context.Context) *Manager {
	return &Manager{
		ctx:       ctx,
		processes: make(map[string]*Process),
	}
}

// Create starts a new shell process and returns its ID.
func (m *Manager) Create(shell, workingDir string) (string, error) {
	p, err := NewProcess(shell, workingDir, m.emitOutput, m.emitExit)
	if err != nil {
		return "", fmt.Errorf("create terminal: %w", err)
	}

	m.mu.Lock()
	m.processes[p.ID] = p
	m.mu.Unlock()

	return p.ID, nil
}

// Write sends raw input bytes to the specified terminal.
func (m *Manager) Write(termID, data string) error {
	p := m.get(termID)
	if p == nil {
		return fmt.Errorf("terminal %q not found", termID)
	}
	return p.Write(data)
}

// Resize changes the terminal dimensions.
func (m *Manager) Resize(termID string, cols, rows int) error {
	p := m.get(termID)
	if p == nil {
		return fmt.Errorf("terminal %q not found", termID)
	}
	return p.Resize(cols, rows)
}

// Close terminates and removes a terminal.
func (m *Manager) Close(termID string) {
	m.mu.Lock()
	p, ok := m.processes[termID]
	if ok {
		delete(m.processes, termID)
	}
	m.mu.Unlock()

	if p != nil {
		p.Close()
	}
}

// CloseAll terminates every active terminal.
func (m *Manager) CloseAll() {
	m.mu.Lock()
	all := make([]*Process, 0, len(m.processes))
	for _, p := range m.processes {
		all = append(all, p)
	}
	m.processes = make(map[string]*Process)
	m.mu.Unlock()

	for _, p := range all {
		p.Close()
	}
}

func (m *Manager) get(termID string) *Process {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.processes[termID]
}

func (m *Manager) emitOutput(termID, data string) {
	runtime.EventsEmit(m.ctx, "terminal:output:"+termID, data)
}

func (m *Manager) emitExit(termID string, exitCode int) {
	m.mu.Lock()
	delete(m.processes, termID)
	m.mu.Unlock()
	runtime.EventsEmit(m.ctx, "terminal:exit:"+termID, exitCode)
}
