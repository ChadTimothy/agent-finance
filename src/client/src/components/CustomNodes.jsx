import React from 'react';
import { Handle, Position } from 'reactflow';

// Product Node
export const ProductNode = ({ data }) => {
  return (
    <div className="product-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-header">Product</div>
      <div className="node-content">
        <div><strong>ID:</strong> {data.product_id}</div>
        <div><strong>Name:</strong> {data.name}</div>
        <div><strong>Lender:</strong> {data.lender}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// Rule Node
export const RuleNode = ({ data }) => {
  return (
    <div className="rule-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-header">Rule</div>
      <div className="node-content">
        <div><strong>ID:</strong> {data.rule_id}</div>
        <div><strong>Scope:</strong> {data.rule_scope}</div>
        <div><strong>Attribute:</strong> {data.policy_attribute}</div>
        <div><strong>Operator:</strong> {data.operator}</div>
        <div><strong>Value:</strong> {data.rule_value}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// Question Node
export const QuestionNode = ({ data }) => {
  return (
    <div className="question-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-header">Question</div>
      <div className="node-content">
        <div><strong>ID:</strong> {data.question_id}</div>
        <div><strong>Key:</strong> {data.question_key}</div>
        <div><strong>Text:</strong> {data.question_text}</div>
        <div><strong>Group:</strong> {data.question_group}</div>
        <div><strong>Type:</strong> {data.answer_type}</div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}; 