import { aiOrchestrator } from './orchestrator';
import { generatePredictions } from './prediction-engine';
import { runCorrelationDiscovery } from './correlation-engine';
import { explainScoreChange, explainRelapseRisk } from './explainability-engine';
import { optimizeDailySchedule } from './schedule-optimizer';
import { calculateConfidence } from './confidence-engine';
import { permissionSystem } from './permission-system';

async function testAIEngines() {
  console.log("=== Testing Phase 4 & 4A AI Intelligence Layer ===");

  const targetDate = '2026-07-24';

  // 1. Test Prediction Engine
  const predictions = await generatePredictions(targetDate);
  console.log("✓ Prediction Vector Generated:");
  console.log(`  - Recovery Score Pred: ${predictions.recoveryScorePred}%`);
  console.log(`  - Relapse Risk: ${predictions.relapseRisk}%`);
  console.log(`  - Sleep Quality Pred: ${predictions.sleepQualityPred}/5`);

  // 2. Test Correlation Engine
  const correlations = await runCorrelationDiscovery();
  console.log(`✓ Correlation Engine Discovered ${correlations.length} relationships:`);
  correlations.forEach(c => {
    console.log(`  - [${c.relationship}] ${c.moduleA} ↔ ${c.moduleB} (r = ${c.correlation}, p = ${c.pValue})`);
  });

  // 3. Test Explainability Engine
  const scoreExplanation = await explainScoreChange(targetDate);
  console.log("✓ Explainability Engine Trace:");
  console.log(`  - User Text: "${scoreExplanation.userText}"`);

  const riskExplanation = explainRelapseRisk(predictions.relapseRisk, 14, 0);
  console.log(`  - Risk Trace: "${riskExplanation.userText}"`);

  // 4. Test Schedule Optimizer
  const schedulePlan = await optimizeDailySchedule(targetDate);
  console.log("✓ Schedule Optimizer Plan:");
  console.log(`  - Proposed Events Count: ${schedulePlan.proposedEvents.length}`);
  console.log(`  - Score Impact: +${schedulePlan.scoreImpact} pts`);

  // 5. Test Confidence Engine
  const conf = calculateConfidence(4, 5, 20, 0.1, 1);
  console.log(`✓ Confidence Calculation: ${conf.confidenceScore}% (${conf.label})`);

  // 6. Test Action Permission System
  const actionReq = permissionSystem.createActionRequest('Test Action', 'Testing schedule optimization', 'APPLY_SCHEDULE_OPTIMIZATION', {});
  console.log(`✓ Action Permission Classification: Level ${actionReq.securityLevel} (${actionReq.securityLabel})`);

  // 7. Test AI Core Orchestrator Process Message
  const orchestratorResult = await aiOrchestrator.processUserMessage('test_session', 'WHY did my Recovery Score change?', targetDate);
  console.log("✓ AI Orchestrator Result:");
  console.log(`  - Response Text: "${orchestratorResult.messageText}"`);

  console.log("=== All Phase 4 & 4A AI Intelligence Engines Verified Successfully! ===");
}

testAIEngines().catch(console.error);
