import React, { useState, useEffect } from 'react';

const NodeDetailPanel = ({ selectedNode, onUpdateNode, onClose }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (selectedNode) {
      setFormData({ ...selectedNode });
    } else {
      setFormData({});
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return null;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdateNode(formData);
  };

  const renderFields = () => {
    // Different fields based on node type
    if (selectedNode.type === 'product') {
      return (
        <>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label>Lender</label>
            <input
              type="text"
              name="lender"
              value={formData.lender || ''}
              onChange={handleChange}
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              className="form-control"
              rows="3"
            />
          </div>
        </>
      );
    } else if (selectedNode.type === 'rule') {
      return (
        <>
          <div className="form-group">
            <label>Policy Attribute</label>
            <input
              type="text"
              name="policy_attribute"
              value={formData.policy_attribute || ''}
              onChange={handleChange}
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label>Operator</label>
            <select
              name="operator"
              value={formData.operator || ''}
              onChange={handleChange}
              className="form-control"
            >
              <option value="==">Equals (==)</option>
              <option value="!=">Not Equals (!=)</option>
              <option value=">">{`>`} Greater Than</option>
              <option value="<">{`<`} Less Than</option>
              <option value=">=">{`>=`} Greater Than or Equal</option>
              <option value="<=">{`<=`} Less Than or Equal</option>
              <option value="IN">In List (IN)</option>
              <option value="NOT IN">Not In List (NOT IN)</option>
              <option value="Exists">Exists</option>
              <option value="NotExists">Not Exists</option>
            </select>
          </div>
          <div className="form-group">
            <label>Rule Value</label>
            <input
              type="text"
              name="rule_value"
              value={formData.rule_value || ''}
              onChange={handleChange}
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label>Value Type</label>
            <select
              name="value_type"
              value={formData.value_type || ''}
              onChange={handleChange}
              className="form-control"
            >
              <option value="String">String</option>
              <option value="Number">Number</option>
              <option value="Boolean">Boolean</option>
              <option value="List_String">List of Strings</option>
              <option value="List_Number">List of Numbers</option>
            </select>
          </div>
        </>
      );
    } else if (selectedNode.type === 'question') {
      return (
        <>
          <div className="form-group">
            <label>Question Key</label>
            <input
              type="text"
              name="question_key"
              value={formData.question_key || ''}
              onChange={handleChange}
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label>Question Text</label>
            <textarea
              name="question_text"
              value={formData.question_text || ''}
              onChange={handleChange}
              className="form-control"
              rows="3"
            />
          </div>
          <div className="form-group">
            <label>Question Group</label>
            <input
              type="text"
              name="question_group"
              value={formData.question_group || ''}
              onChange={handleChange}
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label>Answer Type</label>
            <select
              name="answer_type"
              value={formData.answer_type || ''}
              onChange={handleChange}
              className="form-control"
            >
              <option value="String">String</option>
              <option value="Number">Number</option>
              <option value="Boolean">Boolean</option>
              <option value="List_String">List of Strings</option>
              <option value="List_Number">List of Numbers</option>
            </select>
          </div>
        </>
      );
    }
    
    return null;
  };

  return (
    <div className="edit-panel">
      <div className="panel-header">
        <h3>Edit {selectedNode.type}</h3>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>
      
      <form onSubmit={handleSubmit}>
        {renderFields()}
        
        <div className="button-group">
          <button type="submit" className="btn btn-primary">Save Changes</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default NodeDetailPanel; 