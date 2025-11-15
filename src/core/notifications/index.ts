/**
 * Notifications Module - Centralized notification system
 *
 * This module provides a unified interface for sending notifications
 * across multiple channels (ClickUp, Discord, console).
 */

export * from './types';
export { ClickUpNotifier } from './clickup-notifier';
export { NotificationManager, notificationManager } from './notification-manager';

// Default export for convenience
import { notificationManager } from './notification-manager';
export default notificationManager;
