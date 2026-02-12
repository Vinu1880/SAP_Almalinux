#!/usr/bin/env tsx

// scripts/sync-outlook.ts
// Script to manually synchronize Outlook responses

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret-change-in-production';
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

async function syncOutlookResponses() {
  console.log('Starting Outlook responses synchronization...');
  console.log(`API endpoint: ${BASE_URL}/api/cron/sync-outlook-responses`);

  try {
    const response = await fetch(`${BASE_URL}/api/cron/sync-outlook-responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Synchronization failed:');
      console.error(error);
      process.exit(1);
    }

    const result = await response.json();

    console.log('\nSynchronization completed successfully!');
    console.log(`\nResults:`);
    console.log(`   - Checked: ${result.checked} assignments`);
    console.log(`   - Updated: ${result.updated} assignments`);
    console.log(`   - Errors: ${result.errors}`);

    if (result.results && result.results.length > 0) {
      console.log('\nDetails:');
      result.results.forEach((r: any, index: number) => {
        if (r.success) {
          console.log(`   ${index + 1}. OK ${r.userEmail} - ${r.shiftName}: ${r.oldStatus} -> ${r.newStatus}`);
        } else {
          console.log(`   ${index + 1}. FAIL ${r.userEmail}: ${r.error}`);
        }
      });
    }

    console.log('\nDone!');
  } catch (error) {
    console.error('Error during synchronization:');
    console.error(error);
    process.exit(1);
  }
}

// Check status before synchronizing
async function checkSyncStatus() {
  try {
    const response = await fetch(`${BASE_URL}/api/cron/sync-outlook-responses`, {
      method: 'GET'
    });

    if (!response.ok) {
      console.error('Failed to check sync status');
      return;
    }

    const status = await response.json();

    console.log('Current sync status:');
    console.log(`   - Pending assignments: ${status.pendingAssignments}`);
    console.log(`   - Recent syncs: ${status.recentSyncs}`);
    console.log(`   - Last sync: ${status.lastSync ? new Date(status.lastSync).toLocaleString() : 'Never'}`);
    console.log('');
  } catch (error) {
    console.error('Error checking sync status:', error);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'status' || command === '--status' || command === '-s') {
    await checkSyncStatus();
  } else if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`
Outlook Sync Script

Usage:
  tsx scripts/sync-outlook.ts [command]

Commands:
  (none)     Run synchronization
  status     Check synchronization status
  help       Show this help message

Environment variables:
  NEXT_PUBLIC_URL    Base URL (default: http://localhost:3000)
  CRON_SECRET        Secret for cron authentication

Examples:
  tsx scripts/sync-outlook.ts          # Run sync
  tsx scripts/sync-outlook.ts status   # Check status
    `);
  } else {
    await checkSyncStatus();
    await syncOutlookResponses();
  }
}

main().catch(console.error);
