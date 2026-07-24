import React, { useState } from 'react';

export default function ChatPage({ auth }) {
    const [messages, setMessages] = useState([
        {
            id: 'init',
            speaker: 'system',
            text: 'Welcome to the SETU Platform. Enter an offender name, phone number, vehicle plate, or case ID to retrieve matching knowledge graph subgraphs.',
            evidence: null
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [selectedEvidence, setSelectedEvidence] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);

    const handleExportPDF = async () => {
        if (messages.length === 0) return;
        setExportingPdf(true);
        try {
            const res = await fetch('http://localhost:5001/api/report-generator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'chat',
                    title: 'SETU Investigation Chat Transcript',
                    generated_by: auth?.username || 'K_PATEL_5601',
                    messages: messages
                })
            });
            const data = await res.json();
            if (data.status === 'success' && data.pdf_base64) {
                const blob = new Blob([Uint8Array.from(atob(data.pdf_base64), c => c.charCodeAt(0))], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chat_transcript_${Date.now()}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error("PDF Export failed:", e);
        } finally {
            setExportingPdf(false);
        }
    };

    // Suggested queries for demo execution per demo-script.md
    const suggestedQueries = [
        "show me cases linked to Md. Rafique across districts",
        "check reoffense risk score for OFF_MOHD_RAFIQ",
        "check reoffense risk score for OFF_RAMESH",
        "scan for Modus Operandi anomalies on OFF_MOHD_RAFIQ"
    ];

    const sendMessage = async (text) => {
        if (!text.trim()) return;

        // Append user query
        const userMsg = { id: `user_${Date.now()}`, speaker: 'user', text };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLoading(true);

        try {
            // Frontend keyword-based query routing (simplification for local simulation)
            let apiEndpoint = 'chat-query';
            let requestBody = { 
                query: text,
                role: auth?.role || 'investigator',
                district: auth?.district || 'Tumkur'
            };

            const isRiskQuery = text.toLowerCase().includes('risk score');
                                
            const isAnomalyQuery = text.toLowerCase().includes('anomalies') || 
                                   text.toLowerCase().includes('modus operandi') ||
                                   text.toLowerCase().includes('anomaly');

            if (isAnomalyQuery) {
                apiEndpoint = 'anomaly-detection';
                let targetId = 'OFF_MOHD_RAFIQ';
                if (text.toLowerCase().includes('off_ramesh')) {
                    targetId = 'OFF_RAMESH';
                } else if (text.toLowerCase().includes('off_rafiq')) {
                    targetId = 'OFF_RAFIQ';
                }
                requestBody = { 
                    offender_id: targetId, 
                    fir_id: targetId === 'OFF_MOHD_RAFIQ' ? 'FIR-2024-0117' : 'FIR-004',
                    role: auth?.role || 'investigator',
                    district: auth?.district || 'Tumkur'
                };
            } else if (isRiskQuery) {
                apiEndpoint = 'risk-scoring';
                let targetId = 'OFF_MOHD_RAFIQ';
                if (text.toLowerCase().includes('off_ramesh')) {
                    targetId = 'OFF_RAMESH';
                } else if (text.toLowerCase().includes('off_rafiq')) {
                    targetId = 'OFF_RAFIQ';
                }
                requestBody = { 
                    offender_id: targetId, 
                    fir_id: targetId === 'OFF_MOHD_RAFIQ' ? 'FIR-2024-0001' : 'FIR-004',
                    role: auth?.role || 'investigator',
                    district: auth?.district || 'Tumkur'
                };
            }

            const res = await fetch(`http://localhost:5001/api/${apiEndpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await res.json();

            let responseText = "";
            let responseEvidence = null;

            if (apiEndpoint === 'chat-query') {
                responseText = data.answer;
                responseEvidence = data.evidence;
            } else if (apiEndpoint === 'risk-scoring') {
                responseText = `### Risk Assessment Profile: ${data.offender_id}\n\n` +
                               `*   **Calculated Reoffense Risk**: **${(data.risk_score * 100).toFixed(0)}%**\n` +
                               `*   **Witness Tampering Risk**: **${(data.witness_tampering_risk * 100).toFixed(0)}%**\n` +
                               `*   **Tampering Rationale**: "${data.witness_tampering_reasoning}"\n` +
                               `*   *Action Recommended*: Flag for bail status review.`;
                responseEvidence = data.evidence;
            } else if (apiEndpoint === 'anomaly-detection') {
                if (data.raised_anomaly_flag) {
                    responseText = `⚠️ **[ANOMALY ALERT] Pattern-Break Flag Raised!**\n\n` +
                                   `*   **Offender ID**: ${data.offender_id}\n` +
                                   `*   **MO Shift Jaccard Deviation**: **${(data.deviation_score * 100).toFixed(0)}%**\n` +
                                   `*   **Historical Case Count**: ${data.historical_cases_count}\n` +
                                   `*   **Reasoning**: Offender has shifted operations (pattern break flagged).`;
                } else {
                    responseText = `No significant Modus Operandi shifts or anomalies detected for offender ${data.offender_id} (deviation = ${(data.deviation_score * 100).toFixed(0)}%).`;
                }
                responseEvidence = data.evidence;
            }

            const sysMsg = {
                id: `sys_${Date.now()}`,
                speaker: 'system',
                text: responseText,
                evidence: responseEvidence
            };

            setMessages(prev => [...prev, sysMsg]);
            if (responseEvidence) {
                // Focus the actual backend-supplied evidence
                setSelectedEvidence(responseEvidence);
            }

        } catch (e) {
            console.error("API Call Failed:", e);
            setMessages(prev => [...prev, {
                id: `err_${Date.now()}`,
                speaker: 'system',
                text: `⚠️ Connection to local API Simulation Server failed. Please ensure the backend is running on port 5001.`,
                evidence: null
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyLead = () => {
        if (selectedEvidence) {
            setSelectedEvidence(prev => ({
                ...prev,
                verification_status: 'verified',
                verified_by: 'IO_K_PATEL_5601',
                verification_notes: 'Independently verified cross-district records matching suspect profiles.'
            }));
            
            setMessages(prev => prev.map(m => {
                if (m.evidence && m.evidence.record_id === selectedEvidence.record_id) {
                    return {
                        ...m,
                        evidence: { ...m.evidence, verification_status: 'verified' }
                    };
                }
                return m;
            }));
        }
    };

    return (
        <div className="chat-page-container">
            {/* Left Hand: Glassmorphic conversational window */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: '0 0 5px 0' }}>SETU Conversational Search</h3>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                            Query regional intelligence database in English / Kannada.
                        </p>
                    </div>
                    <button 
                        onClick={handleExportPDF}
                        disabled={exportingPdf}
                        style={{
                            background: 'linear-gradient(135deg, #7f5af0, #2cb67d)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 14px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(127, 90, 240, 0.3)'
                        }}
                    >
                        {exportingPdf ? 'Exporting PDF...' : '📄 Save Conversation as PDF'}
                    </button>
                </div>

                <div className="chat-window">
                    {messages.map(msg => (
                        <div key={msg.id} className={`msg-bubble ${msg.speaker}`}>
                            <div className="msg-header">
                                {msg.speaker === 'user' ? 'Investigator' : 'SETU Intel Assistant'}
                                {msg.evidence && (
                                    <button 
                                        className="explain-trigger-icon" 
                                        title="View Explainability Audit Log"
                                        onClick={() => setSelectedEvidence(msg.evidence)}
                                    >
                                        ?
                                    </button>
                                )}
                            </div>
                            <div className="msg-text" style={{ whiteSpace: 'pre-wrap' }}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="msg-bubble system">
                            <div className="msg-header">SETU Intel Assistant</div>
                            <div className="msg-text">Analyzing knowledge graph...</div>
                        </div>
                    )}
                </div>

                {/* Suggested Demo Queries */}
                <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                        Suggested Demo Scripts:
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {suggestedQueries.map((q, idx) => (
                            <button 
                                key={idx} 
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(127, 90, 240, 0.3)',
                                    color: 'var(--text-muted)',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                                onClick={() => sendMessage(q)}
                            >
                                "{q}"
                            </button>
                        ))}
                    </div>
                </div>

                <div className="chat-input-row">
                    <input 
                        type="text"
                        className="chat-input"
                        placeholder="Type query (e.g. 'show me cases linked to Md. Rafique')"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage(inputText)}
                    />
                    <button className="send-btn" onClick={() => sendMessage(inputText)}>
                        Send
                    </button>
                </div>
            </div>

            {/* Right Hand: Sliding/Fixed Side Panel showing Explainability details */}
            <div className="glass-panel" style={{ height: 'fit-content' }}>
                <h4 className="side-panel-header">Explainability Record</h4>
                
                {selectedEvidence ? (
                    <div>
                        <div style={{ marginBottom: '15px' }}>
                            <span className="field" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Evidence ID:</span>
                            <div style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--primary-hover)' }}>{selectedEvidence.record_id}</div>
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <span className="field" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status:</span>
                            <div style={{ marginTop: '5px' }}>
                                <span className={`badge ${selectedEvidence.verification_status}`}>
                                    {selectedEvidence.verification_status}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <span className="field" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Decision Logic:</span>
                            <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '3px' }}>
                                {selectedEvidence.reasoning_summary}
                            </div>
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <span className="field" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Source cases:</span>
                            <div style={{ fontSize: '13px', fontFamily: 'monospace', marginTop: '3px' }}>
                                {selectedEvidence.source_fir_ids}
                            </div>
                        </div>

                        {selectedEvidence.verified_by && (
                            <div style={{ marginBottom: '15px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                                <span className="field" style={{ fontSize: '12px', color: 'var(--accent)' }}>Verified By:</span>
                                <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>{selectedEvidence.verified_by}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                                    "{selectedEvidence.verification_notes}"
                                </div>
                            </div>
                        )}

                        {selectedEvidence.verification_status === 'unverified' && (
                            <button 
                                className="send-btn" 
                                style={{ width: '100%', background: 'var(--accent)', borderColor: 'var(--accent)', marginTop: '10px' }}
                                onClick={handleVerifyLead}
                            >
                                Verify Lead (Sign-off)
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '14px' }}>
                        Click the "?" icon on any system response bubble to inspect its raw algorithmic audit trail.
                    </div>
                )}
            </div>
        </div>
    );
}
