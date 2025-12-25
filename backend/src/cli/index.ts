#!/usr/bin/env node
/**
 * CLI tool for Mind2Build
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { generateCommand } from './commands/generate';
import { logger } from '../utils';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('mind2build')
  .description('Mind2Build - AI Multi-Agent Project Generator')
  .version('1.0.0');

// Generate command
program
  .command('generate <idea>')
  .description('Generate a complete project from an idea')
  .option('-o, --output <directory>', 'Output directory for generated files')
  .option('-b, --budget <amount>', 'Maximum budget in USD', '10.0')
  .option('-r, --rounds <number>', 'Maximum execution rounds', '5')
  .option('-i, --interactive', 'Enable interactive mode with manual confirmation at each step', false)
  .action(async (idea: string, options: any) => {
    try {
      options.budget = parseFloat(options.budget);
      options.rounds = parseInt(options.rounds);
      options.interactive = options.interactive || false;
      await generateCommand(idea, options);
    } catch (error: any) {
      logger.error('CLI error:', error);
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Status command (placeholder)
program
  .command('status <project-id>')
  .description('Check project generation status')
  .action((projectId: string) => {
    console.log(`Status for project ${projectId}:`);
    console.log('This command requires API server integration');
  });

// List command (placeholder)
program
  .command('list')
  .description('List all projects')
  .action(() => {
    console.log('Projects:');
    console.log('This command requires API server integration');
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

