import blessed from 'blessed';
import axios from 'axios';

// Define API base URL (ensure backend server is running)
const API_BASE_URL = 'http://localhost:3001/api'; // Make sure this matches your backend port

// --- UI Element Setup ---
function setupLayout() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Loan Product Finder TUI'
  });

  const layout = blessed.box({
    parent: screen,
    top: 0, left: 0, width: '100%', height: '100%',
    border: 'line',
    label: ' Loan Product Finder '
  });

  const questionBox = blessed.box({
    parent: layout, top: 1, left: 1, right: 1, height: 'shrink',
    content: 'Initializing...',
    border: 'line', label: 'Question'
  });

  const resultsOrInputContainer = blessed.box({
    parent: layout, top: 5, left: 1, right: 1, border: 'line',
    label: 'Answer / Results' 
    // Height/Bottom determined dynamically
  });

  const eligibleProductsContainer = blessed.box({
    parent: layout, height: 0, left: 1, right: 1, border: 'line',
    label: 'Eligible Products (Press P to toggle)'
    // Top/Bottom determined dynamically
  });

  const historyContainer = blessed.box({
    parent: layout, height: 0, bottom: 3, left: 1, right: 1,
    border: 'line', label: 'Q&A History'
  });

  const statusBar = blessed.text({
    parent: layout, bottom: 1, left: 1, height: 'shrink',
    content: 'Status: Ready | Press Q or Esc to Exit | P to Toggle Products',
    style: { fg: 'yellow' }
  });

  return {
    screen, layout, questionBox, resultsOrInputContainer, 
    eligibleProductsContainer, historyContainer, statusBar
  };
}

function setupKeybindings(screen, toggleProductsCallback, exitCallback) {
  screen.key(['escape', 'q', 'C-c'], exitCallback);
  screen.key(['p'], toggleProductsCallback);
}

// --- Global State (Managed within main scope) --- 
// let activeInputElement = null; // Keep track of the current input/table/log element - Now managed locally
// const qaHistory = []; // Array to store { questionText, answerValue } - Now managed locally
// let showEligibleProducts = false; // Toggle state for showing products - Now managed locally
// let currentEligibleProducts = []; // Store the latest list of products - Now managed locally
// let isResultsScreenActive = false; // Flag to disable toggle on results screen - Now managed locally

// --- Main Application Logic ---
async function main() {
  // Setup UI
  const ui = setupLayout();
  const { 
    screen, layout, questionBox, resultsOrInputContainer, 
    eligibleProductsContainer, historyContainer, statusBar 
  } = ui;

  // State specific to this run
  let sessionId = null;
  let currentQuestion = null;
  const userAnswers = {};
  const qaHistory = []; 
  let showEligibleProducts = false; 
  let currentEligibleProducts = [];
  let isResultsScreenActive = false; 
  let activeInputElement = null; // Track focused/active element within this scope

  // --- Helper Functions using UI and State ---
  function updateStatus(message) {
    statusBar.setContent(`Status: ${message} | Press Q or Esc to Exit | P to Toggle Products`);
    screen.render();
  }
  
  function clearActiveInputElement() {
      if (activeInputElement) {
          activeInputElement.destroy();
          activeInputElement = null;
          // screen.render(); // Render is usually called after this by the caller
      }
  }

  // Function to update the eligible products display area
  function updateEligibleProductsDisplay() {
    // Clear previous content if any
    for (const child of eligibleProductsContainer.children) {
        child.destroy();
    }

    const mainContainerBottomMargin = 3; // Space for status bar
    const topOffset = resultsOrInputContainer.top; // Use container's actual top

    if (showEligibleProducts && currentEligibleProducts.length > 0) {
        const availableHeight = layout.height - topOffset - mainContainerBottomMargin - 2; 
        const productsHeight = Math.max(3, Math.floor(availableHeight * 0.35));
        
        eligibleProductsContainer.height = productsHeight;
        eligibleProductsContainer.bottom = mainContainerBottomMargin; 
        eligibleProductsContainer.top = layout.height - mainContainerBottomMargin - productsHeight;
        resultsOrInputContainer.bottom = eligibleProductsContainer.height + mainContainerBottomMargin; 

        const productList = blessed.list({
            parent: eligibleProductsContainer,
            top: 0, left: 0, right: 0, bottom: 0,
            items: currentEligibleProducts.map(p => `${p.lender_name || 'N/A'} - ${p.product_name || 'N/A'}`),
            style: { item: { fg: 'cyan' } },
            border: 'line'
        });
        eligibleProductsContainer.show();
    } else {
        eligibleProductsContainer.height = 0; 
        eligibleProductsContainer.hide();
        resultsOrInputContainer.bottom = mainContainerBottomMargin; 
    }
    // Recalculate input container height
    resultsOrInputContainer.height = layout.height - resultsOrInputContainer.top - resultsOrInputContainer.bottom - 2; 

    layout.render(); 
    screen.render();
  }

  // Helper to fetch and update product display
  async function fetchAndDisplayEligibleProducts() {
      if (!sessionId) return; 
      try {
          const productsRes = await axios.get(`${API_BASE_URL}/sessions/${sessionId}/eligible_products`);
          currentEligibleProducts = productsRes.data.eligibleProducts || [];
      } catch (prodError) {
          currentEligibleProducts = []; 
          updateStatus(`Error fetching products: ${prodError.message}`);
      }
      updateEligibleProductsDisplay();
  }

  // Toggle callback
  function handleToggleProducts() {
      if (isResultsScreenActive) return;
      showEligibleProducts = !showEligibleProducts;
      updateStatus(showEligibleProducts ? 'Eligible products ON' : 'Eligible products OFF');
      if (showEligibleProducts && sessionId) {
           fetchAndDisplayEligibleProducts(); 
      } else {
          updateEligibleProductsDisplay(); 
      }
  }

  // Exit callback
  function handleExit() {
      return process.exit(0);
  }

  // Setup keybindings
  setupKeybindings(screen, handleToggleProducts, handleExit);

  // --- Core Application Flow Functions ---

  async function askQuestionLoop() {
    clearActiveInputElement();

    if (!currentQuestion) {
      updateStatus('Application complete! Fetching final results...');
      await showResults();
      return;
    }

    // Ensure layout is correct before displaying
    resultsOrInputContainer.top = 4; // Use fixed position
    historyContainer.height = 0; // Hide history during questions
    updateEligibleProductsDisplay(); // Adjust product display/input area
    
    displayQuestion(currentQuestion);
    screen.render();
  }

  function displayQuestion(question) {
    let questionContent = question.question_text || 'No question text available.';
    // Append validation rules (existing logic)
    if (question.validation_rules && typeof question.validation_rules === 'object' && Object.keys(question.validation_rules).length > 0) {
        const rulesSummary = [];
        const rules = question.validation_rules;
        if (rules.min !== undefined) rulesSummary.push(`min: ${rules.min}`);
        if (rules.max !== undefined) rulesSummary.push(`max: ${rules.max}`);
        if (rules.minLength !== undefined) rulesSummary.push(`min length: ${rules.minLength}`);
        if (rules.maxLength !== undefined) rulesSummary.push(`max length: ${rules.maxLength}`);
        if (rules.pattern !== undefined) rulesSummary.push(`format: ${rules.pattern}`); 
        if (rulesSummary.length > 0) {
            questionContent += `\n{yellow-fg}(Validation: ${rulesSummary.join(', ')}){/yellow-fg}`;
        }
    }
    questionBox.setContent(questionContent);
    updateStatus('Awaiting answer...');
    resultsOrInputContainer.setLabel('Answer'); 
    resultsOrInputContainer.show();

    clearActiveInputElement(); // Ensure previous is gone

    // TODO: Extract widget creation to a helper function
    // Create input based on type (logic is the same as before)
    if (question.possible_answers && question.possible_answers.length > 0) {
        // Handle both object {label, value} and primitive string/number answers
        const items = question.possible_answers.map(ans => {
          if (typeof ans === 'object' && ans !== null) {
            return ans.label || (ans.value !== undefined && ans.value !== null ? ans.value.toString() : ''); // Use label if available, else value as string
          } else if (ans !== undefined && ans !== null) {
            return ans.toString(); // Handle primitive types directly
          }
          return ''; // Fallback for unexpected null/undefined in array
        });
        const list = blessed.list({ /* ... options ... */ parent: resultsOrInputContainer, items: items, top:0, bottom:0, left:0, right:0, border:'line', keys:true, vi:true, mouse:true, style:{selected:{bg:'blue'}, item:{fg:'white'}}});
        list.focus();
        activeInputElement = list;
        list.on('select', (item, index) => {
            const selectedAnswer = question.possible_answers[index];
            // Handle selection for both object {value, label} and primitive answers
            let answerValue = null;
            if (typeof selectedAnswer === 'object' && selectedAnswer !== null) {
              answerValue = selectedAnswer.value; // Get value from object
            } else {
              answerValue = selectedAnswer; // Use primitive value directly
            }
            
            // Ensure value is not undefined/null before submitting
            if (answerValue !== undefined && answerValue !== null) {
                qaHistory.push({ questionText: currentQuestion?.question_text, answerValue });
                submitAnswer(question.question_key, answerValue);
            }
        });
    } else if (question.answer_type === 'Number' || question.answer_type === 'String') {
        const textbox = blessed.textbox({ /* ... options ... */ parent: resultsOrInputContainer, top:0, left:0, height:3, right:0, border:'line', inputOnFocus:true, style:{fg:'white', bg:'black', focus:{bg:'grey'}}});
        textbox.focus();
        activeInputElement = textbox;
        textbox.on('submit', (value) => {
            let processedValue = value;
            if (question.answer_type === 'Number') {
                const num = Number.parseFloat(value);
                if (!Number.isNaN(num)) {
                    processedValue = num;
                } else {
                    updateStatus(`Invalid number: "${value}"`); return; 
                }
            }
            qaHistory.push({ questionText: currentQuestion?.question_text, answerValue: processedValue });
            submitAnswer(question.question_key, processedValue);
        });
    } else { 
        questionBox.setContent(`${question.question_text}\n(Input type ${question.answer_type} not supported)`);
        activeInputElement = blessed.text({ parent: resultsOrInputContainer, content: 'Press Q/Esc.'});
    }
    screen.render();
  }

  async function submitAnswer(questionKey, answerValue) {
    userAnswers[questionKey] = answerValue; 
    updateStatus(`Submitting: ${questionKey} = ${JSON.stringify(answerValue)}...`);
    clearActiveInputElement(); 
    screen.render();

    try {
      await axios.post(`${API_BASE_URL}/sessions/${sessionId}/answers`, { questionKey, answerValue });

      if (showEligibleProducts) { await fetchAndDisplayEligibleProducts(); }
       else { currentEligibleProducts = []; updateEligibleProductsDisplay(); }

      updateStatus('Fetching next question...');
      const nextQuestionRes = await axios.get(`${API_BASE_URL}/sessions/${sessionId}/next_question`);
      currentQuestion = nextQuestionRes.data.nextQuestion;

      askQuestionLoop(); 

    } catch (error) {
      updateStatus(`Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async function showResults() {
    isResultsScreenActive = true; 
    updateStatus('Fetching final results...');
    try {
      const resultsRes = await axios.get(`${API_BASE_URL}/sessions/${sessionId}/eligible_products`);
      const products = resultsRes.data.eligibleProducts;

      const mainContainerBottomMargin = 3; 

      questionBox.setContent('Eligible Products:');
      clearActiveInputElement(); // Clear potential input widget
      resultsOrInputContainer.setLabel('Results'); 
      eligibleProductsContainer.height = 0; 
      eligibleProductsContainer.hide();

      // Final Layout Calculation
      const totalHeight = layout.height - 4;
      const tableHeight = products && products.length > 0 ? Math.min(products.length + 3, Math.floor(totalHeight * 0.6)) : 3;
      const historyHeight = Math.max(3, totalHeight - tableHeight);
      resultsOrInputContainer.height = tableHeight;
      resultsOrInputContainer.top = 4; 
      resultsOrInputContainer.bottom = historyHeight + mainContainerBottomMargin; 
      historyContainer.height = historyHeight;
      historyContainer.top = resultsOrInputContainer.top + tableHeight;
      historyContainer.bottom = mainContainerBottomMargin;

      // Display Results Table or Message
      if (products && products.length > 0) {
        // Restore full headers and data mapping
        const headers = ['Lender', 'Product', 'Type', 'Min Amt', 'Max Amt', 'Min Term', 'Max Term', 'Base Rate', 'Max Rate'];
        const tableData = products.map(p => [
          p.lender_name || 'N/A',
          p.product_name || 'N/A',
          p.loan_type || 'N/A',
          p.min_loan_amount?.toString() || '-',
          p.max_loan_amount?.toString() || '-',
          p.min_term_months?.toString() || '-',
          p.max_term_months?.toString() || '-',
          p.base_rate?.toString() || '-',
          p.worst_case_rate?.toString() || '-'
        ]);
        
        // Create table structure first
        const resultsTable = blessed.table({ 
            parent: resultsOrInputContainer, 
            top:0, left:0, right:0, 
            bottom: 0, // Let table fill the container height
            border:'line', 
            align:'left', 
            noCellBorders: true, // Try removing cell borders
            style:{header:{bold:true, fg:'blue'}, cell:{fg:'white'}}, 
            columnWidth:[15, 25, 10, 10, 10, 10, 10, 10, 10] // Keep fixed widths
        });
        // Set simplified data explicitly AFTER creation
        resultsTable.setData([headers, ...tableData]);

        activeInputElement = resultsTable; 
      } else {
        activeInputElement = blessed.box({ parent: resultsOrInputContainer, content: 'No eligible products found.', top: 1, left: 1 });
        resultsOrInputContainer.render(); 
      }

      // Display Q&A History
      historyContainer.show();
      const historyLog = blessed.log({ /* ... options ... */ parent: historyContainer, top:0, left:0, right:0, bottom:0, border:'line', scrollable:true, alwaysScroll:true, scrollbar:{ch:' ', bg:'blue'}, keys:true, vi:true, mouse:true, content:'' });
      for (const item of qaHistory) {
          historyLog.log(`Q: ${item.questionText}`);
          historyLog.log(`A: ${JSON.stringify(item.answerValue)}`);
          historyLog.log('---');
      }
      updateStatus('Done. Use Arrows/PgUp/PgDn in History. Press Q or Esc to Exit.');
      historyLog.focus(); 
      screen.render(); // Ensure final render

    } catch (error) {
        updateStatus(`Error fetching results: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // --- Initial API Call ---
  try {
    updateStatus('Creating session...');
    const sessionRes = await axios.post(`${API_BASE_URL}/sessions`);
    sessionId = sessionRes.data.sessionId;
    currentQuestion = sessionRes.data.nextQuestion;
    if (!sessionId) throw new Error('Failed to create session.');
    updateStatus('Session created.');
    await fetchAndDisplayEligibleProducts(); 
    askQuestionLoop();
  } catch (error) {
    updateStatus(`Error starting session: ${error.message}`);
    // Render needed after initial status update failure
    screen.render(); 
  }
}

// Start the main application logic
main(); 