import type { AIActionRequest, ActionSecurityLevel } from './types';

class ActionPermissionSystem {
  /**
   * Evaluates proposed AI action against security classification rules
   */
  classifyAction(actionType: string, payload: any): { securityLevel: ActionSecurityLevel; securityLabel: AIActionRequest['securityLabel'] } {
    // Level 4: Prohibited / Never Automatic
    if (actionType.includes('EXFILTRATE') || actionType.includes('DELETE_DATABASE') || actionType.includes('MODIFY_GPS')) {
      return { securityLevel: 4, securityLabel: 'Never Automatic' };
    }

    // Level 3: Restricted (Multi-step re-confirmation required)
    if (actionType.includes('OVERWRITE_HISTORICAL_LOG') || actionType.includes('RESTORE_BACKUP')) {
      return { securityLevel: 3, securityLabel: 'Restricted' };
    }

    // Level 2: Confirmation Required (One-click user prompt)
    if (actionType.includes('APPLY_SCHEDULE_OPTIMIZATION') || actionType.includes('CREATE_GOAL') || actionType.includes('UPDATE_TARGET')) {
      return { securityLevel: 2, securityLabel: 'Confirmation Required' };
    }

    // Level 1: Automatic (Read-only context, cache updates)
    return { securityLevel: 1, securityLabel: 'Automatic' };
  }

  /**
   * Processes action execution request
   */
  createActionRequest(title: string, description: string, actionType: string, payload: any): AIActionRequest {
    const { securityLevel, securityLabel } = this.classifyAction(actionType, payload);

    return {
      id: `act_${Date.now()}`,
      title,
      description,
      actionType,
      securityLevel,
      securityLabel,
      payload,
      status: securityLevel === 1 ? 'executed' : 'pending',
      createdAt: Date.now()
    };
  }
}

export const permissionSystem = new ActionPermissionSystem();
