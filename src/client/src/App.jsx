import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';

import { ProductNode, RuleNode, QuestionNode } from './components/CustomNodes';
import NodeDetailPanel from './components/NodeDetailPanel';

// Define node types for reactflow
const nodeTypes = {
  product: ProductNode,
  rule: RuleNode,
  question: QuestionNode
};

const App = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [error, setError] = useState(null);
  const [layout, setLayout] = useState('hierarchical'); // 'hierarchical' or 'force'
  const [filterOptions, setFilterOptions] = useState({
    showProducts: true,
    showRules: true,
    showQuestions: true,
    lenderFilter: '',
    ruleFilter: '',
    questionFilter: ''
  });

  // Handle connections between nodes
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Handle node click (for editing)
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  // Close detail panel
  const onCloseDetailPanel = () => {
    setSelectedNode(null);
  };

  // Update node data
  const onUpdateNode = (updatedData) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...updatedData
            }
          };
        }
        return node;
      })
    );
    // TODO: Implement API call to update data in backend
    setSelectedNode(null);
  };

  // Convert API data to reactflow nodes and edges
  const processData = (data) => {
    const { products, rules, questions } = data;
    const newNodes = [];
    const newEdges = [];
    
    // Starting positions for layout
    const startX = 50;
    const gapY = 200;
    
    // Process Products
    if (products && products.length > 0) {
      products.forEach((product, index) => {
        newNodes.push({
          id: `product-${product.product_id}`,
          type: 'product',
          position: { x: startX + (index * 200), y: 50 },
          data: { ...product, type: 'product' }
        });
      });
    }
    
    // Process Rules
    if (rules && rules.length > 0) {
      rules.forEach((rule, index) => {
        // Add rule node
        newNodes.push({
          id: `rule-${rule.rule_id}`,
          type: 'rule',
          position: { x: startX + (index * 200), y: 50 + gapY },
          data: { ...rule, type: 'rule' }
        });
        
        // Create edges from product to rule if this rule is product-specific
        if (rule.product_id) {
          newEdges.push({
            id: `product-${rule.product_id}-to-rule-${rule.rule_id}`,
            source: `product-${rule.product_id}`,
            target: `rule-${rule.rule_id}`,
            type: 'default'
          });
        }
      });
    }
    
    // Process Questions
    if (questions && questions.length > 0) {
      questions.forEach((question, index) => {
        // Add question node
        newNodes.push({
          id: `question-${question.question_id}`,
          type: 'question',
          position: { x: startX + (index * 200), y: 50 + (gapY * 2) },
          data: { ...question, type: 'question' }
        });
        
        // Link questions to rules that reference them
        if (rules && rules.length > 0) {
          rules.forEach((rule) => {
            // Check if policy_attribute matches question_key
            if (rule.policy_attribute === question.question_key) {
              newEdges.push({
                id: `rule-${rule.rule_id}-to-question-${question.question_id}`,
                source: `rule-${rule.rule_id}`,
                target: `question-${question.question_id}`,
                type: 'default'
              });
            }
          });
        }
      });
    }
    
    return { nodes: newNodes, edges: newEdges };
  };

  // Apply filters to nodes
  const applyFilters = (unfilteredNodes) => {
    return unfilteredNodes.filter(node => {
      const { showProducts, showRules, showQuestions, lenderFilter, ruleFilter, questionFilter } = filterOptions;
      
      // Filter by node type
      if (node.type === 'product' && !showProducts) return false;
      if (node.type === 'rule' && !showRules) return false;
      if (node.type === 'question' && !showQuestions) return false;
      
      // Filter by lender
      if (lenderFilter && node.type === 'product' && node.data.lender) {
        return node.data.lender.toLowerCase().includes(lenderFilter.toLowerCase());
      }
      
      // Filter by rule
      if (ruleFilter && node.type === 'rule') {
        const ruleName = node.data.policy_attribute || '';
        return ruleName.toLowerCase().includes(ruleFilter.toLowerCase());
      }
      
      // Filter by question
      if (questionFilter && node.type === 'question') {
        const questionText = node.data.question_text || '';
        return questionText.toLowerCase().includes(questionFilter.toLowerCase());
      }
      
      return true;
    });
  };

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilterOptions(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get('/api/canvas/data');
        const { nodes: newNodes, edges: newEdges } = processData(response.data);
        
        // Apply filters
        const filteredNodes = applyFilters(newNodes);
        
        // Filter edges to only include those that connect visible nodes
        const filteredNodeIds = filteredNodes.map(node => node.id);
        const filteredEdges = newEdges.filter(edge => 
          filteredNodeIds.includes(edge.source) && 
          filteredNodeIds.includes(edge.target)
        );
        
        setNodes(filteredNodes);
        setEdges(filteredEdges);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [filterOptions]);

  if (loading) {
    return <div className="loading">Loading canvas data...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="dndflow">
      <div className="filter-panel">
        <h4>Filters</h4>
        <div>
          <label>
            <input
              type="checkbox"
              name="showProducts"
              checked={filterOptions.showProducts}
              onChange={handleFilterChange}
            />
            Show Products
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              name="showRules"
              checked={filterOptions.showRules}
              onChange={handleFilterChange}
            />
            Show Rules
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              name="showQuestions"
              checked={filterOptions.showQuestions}
              onChange={handleFilterChange}
            />
            Show Questions
          </label>
        </div>
        <div>
          <label>
            Lender:
            <input
              type="text"
              name="lenderFilter"
              value={filterOptions.lenderFilter}
              onChange={handleFilterChange}
              placeholder="Filter by lender..."
            />
          </label>
        </div>
        <div>
          <label>
            Rule Attribute:
            <input
              type="text"
              name="ruleFilter"
              value={filterOptions.ruleFilter}
              onChange={handleFilterChange}
              placeholder="Filter by rule attribute..."
            />
          </label>
        </div>
        <div>
          <label>
            Question:
            <input
              type="text"
              name="questionFilter"
              value={filterOptions.questionFilter}
              onChange={handleFilterChange}
              placeholder="Filter by question..."
            />
          </label>
        </div>
      </div>
      
      <div className="reactflow-wrapper">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant="dots" gap={12} size={1} />
        </ReactFlow>
      </div>
      
      {selectedNode && (
        <NodeDetailPanel
          selectedNode={selectedNode}
          onUpdateNode={onUpdateNode}
          onClose={onCloseDetailPanel}
        />
      )}
      
      <div className="controls-panel">
        <button
          className="btn"
          onClick={() => {/* TODO: Implement layout algorithm */}}
        >
          Re-layout
        </button>
        <button
          className="btn"
          onClick={() => {/* TODO: Implement save functionality */}}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default App; 