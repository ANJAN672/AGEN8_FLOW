// Test the sequence parsing logic
function parseUserSequence(userPrompt) {
  const sequenceWords = ['then', 'after', 'next', 'followed by', 'and then', 'afterwards', 'subsequently'];
  const lc = userPrompt.toLowerCase();
  
  let steps = [];
  let currentStep = userPrompt;
  
  for (const word of sequenceWords) {
    if (lc.includes(word)) {
      const parts = currentStep.split(new RegExp(word, 'i'));
      if (parts.length > 1) {
        steps = parts.map(p => p.trim()).filter(p => p.length > 0);
        break;
      }
    }
  }
  
  if (steps.length === 0) {
    steps = [userPrompt.trim()];
  }
  
  return steps;
}

// Test with your example
const userRequest = "build a workflow where i can cold emailing from ai agent at start and after emailing agent has to summarise and send the summary through slack channel";

console.log("User Request:", userRequest);
console.log("Parsed Steps:", parseUserSequence(userRequest));