#!/usr/bin/env node

import blessed from 'blessed';
import { spawn } from 'node:child_process';

const exitOnComplete = process.argv.includes('--once');

const screen = blessed.screen({
  smartCSR: true,
  title: 'p2p.red Test Suite'
});

const header = blessed.box({
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  tags: true,
  align: 'center',
  valign: 'middle',
  style: {
    fg: 'white',
    bg: 'blue'
  },
  content: '{bold}p2p.red Test Suite{/bold}  |  {bold}a{/bold} all  {bold}1{/bold} lint  {bold}2{/bold} type  {bold}3{/bold} unit  {bold}4{/bold} e2e  {bold}5{/bold} metadata  {bold}s{/bold} services up  {bold}d{/bold} services down  |  {bold}q{/bold} quit'
});

const statusBox = blessed.box({
  top: 3,
  left: 0,
  width: '30%',
  height: '40%',
  label: ' Status ',
  border: 'line',
  style: {
    border: { fg: 'cyan' }
  },
  tags: true,
  content: 'Idle'
});

const summaryBox = blessed.box({
  top: 3,
  left: '30%',
  width: '70%',
  height: '40%',
  label: ' Summary ',
  border: 'line',
  style: {
    border: { fg: 'green' }
  },
  tags: true,
  content: 'Waiting to start...'
});

const logBox = blessed.log({
  top: '43%',
  left: 0,
  width: '100%',
  height: '57%',
  label: ' Logs ',
  border: 'line',
  style: {
    border: { fg: 'yellow' }
  },
  scrollback: 2000,
  tags: true
});

screen.append(header);
screen.append(statusBox);
screen.append(summaryBox);
screen.append(logBox);

let runningProcess = null;

const tasks = {
  lint: { name: 'lint', label: 'Lint', cmd: 'npm', args: ['run', 'lint'], cwd: '/opt/p2p-file-share' },
  typecheck: { name: 'typecheck', label: 'Type-check', cmd: 'npm', args: ['run', 'type-check'], cwd: '/opt/p2p-file-share' },
  unit: { name: 'unit', label: 'Unit', cmd: 'npm', args: ['run', 'test:unit'], cwd: '/opt/p2p-file-share' },
  e2e: { name: 'e2e', label: 'E2E', cmd: 'npm', args: ['run', 'test:e2e'], cwd: '/opt/p2p-file-share' },
  metadata: { name: 'metadata', label: 'Metadata API', cmd: 'npm', args: ['test'], cwd: '/opt/p2p-file-share/metadata-api' },
  servicesUp: { name: 'services-up', label: 'Services Up', cmd: 'docker', args: ['compose', '-f', 'docker-compose.e2e.yml', 'up', '-d', '--build'], cwd: '/opt/p2p-file-share' },
  servicesDown: { name: 'services-down', label: 'Services Down', cmd: 'docker', args: ['compose', '-f', 'docker-compose.e2e.yml', 'down'], cwd: '/opt/p2p-file-share' }
};

const updateStatus = (text, color = 'cyan') => {
  statusBox.style.border.fg = color;
  statusBox.setContent(text);
  screen.render();
};

const updateSummary = (lines) => {
  summaryBox.setContent(lines.join('\n'));
  screen.render();
};

const runSteps = (steps) => {
  if (runningProcess) {
    return;
  }

  logBox.setContent('');
  updateStatus('Running...', 'yellow');
  updateSummary(steps.map((step) => `${step.label}: pending`));

  const results = {};

  const runStep = (index) => {
    if (index >= steps.length) {
      updateStatus('Completed', 'green');
      const summaryLines = steps.map((step) => {
        const status = results[step.name] || 'pending';
        return `${step.label}: ${status}`;
      });
      updateSummary(summaryLines);
      runningProcess = null;
      if (exitOnComplete) {
        setTimeout(() => process.exit(0), 500);
      }
      return;
    }

    const step = steps[index];
    results[step.name] = 'running';
    updateSummary(steps.map((s) => `${s.label}: ${results[s.name] || 'pending'}`));

    const proc = spawn(step.cmd, step.args, {
      cwd: step.cwd,
      env: process.env,
      shell: true
    });

    runningProcess = proc;

    proc.stdout.on('data', (data) => {
      logBox.add(data.toString());
      screen.render();
    });

    proc.stderr.on('data', (data) => {
      logBox.add(`{red-fg}${data.toString()}{/red-fg}`);
      screen.render();
    });

    proc.on('close', (code) => {
      results[step.name] = code === 0 ? 'passed' : 'failed';
      runningProcess = null;
      runStep(index + 1);
    });
  };

  runStep(0);
};

const runSuite = () => {
  runSteps([
    tasks.lint,
    tasks.typecheck,
    { name: 'tests', label: 'Unit + E2E', cmd: 'npm', args: ['test'], cwd: '/opt/p2p-file-share' },
    tasks.metadata
  ]);
};

const runSingle = (task) => runSteps([task]);

screen.key(['q', 'C-c'], () => {
  if (runningProcess) runningProcess.kill('SIGTERM');
  return process.exit(0);
});

screen.key(['a'], () => {
  if (runningProcess) return;
  runSuite();
});

screen.key(['1'], () => {
  if (runningProcess) return;
  runSingle(tasks.lint);
});

screen.key(['2'], () => {
  if (runningProcess) return;
  runSingle(tasks.typecheck);
});

screen.key(['3'], () => {
  if (runningProcess) return;
  runSingle(tasks.unit);
});

screen.key(['4'], () => {
  if (runningProcess) return;
  runSingle(tasks.e2e);
});

screen.key(['5'], () => {
  if (runningProcess) return;
  runSingle(tasks.metadata);
});

screen.key(['s'], () => {
  if (runningProcess) return;
  runSingle(tasks.servicesUp);
});

screen.key(['d'], () => {
  if (runningProcess) return;
  runSingle(tasks.servicesDown);
});

runSuite();

screen.render();
