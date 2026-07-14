import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';

export default function NetworkGraphPage() {
    const containerRef = useRef(null);
    const cyRef = useRef(null);
    const [graphData, setGraphData] = useState({ offenders: [], network_links: [], phone_links: [], vehicle_links: [] });
    const [selectedEvidence, setSelectedEvidence] = useState(null);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);

    // Fetch and reload graph from local DB
    const fetchGraph = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5001/api/get-graph');
            const data = await res.json();
            if (data.status === 'success') {
                setGraphData(data);
                updateCytoscape(data);
            }
        } catch (e) {
            console.error("Failed to load graph data:", e);
        } finally {
            setLoading(false);
        }
    };

    const triggerSeed = async () => {
        setSeeding(true);
        try {
            await fetch('http://localhost:5001/api/seed-graph', { method: 'POST' });
            await fetchGraph();
        } catch (e) {
            console.error("Seeding failed:", e);
        } finally {
            setSeeding(false);
        }
    };

    // Initialize Cytoscape container once
    useEffect(() => {
        if (!containerRef.current) return;

        const cy = cytoscape({
            container: containerRef.current,
            elements: [],
            style: [
                {
                    selector: 'node',
                    style: {
                        'content': 'data(label)',
                        'color': '#fffffe',
                        'font-family': 'Outfit, sans-serif',
                        'font-size': '11px',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'background-color': '#1a1b26',
                        'border-color': 'rgba(127, 90, 240, 0.6)',
                        'border-width': '2px',
                        'width': '55px',
                        'height': '55px',
                        'text-wrap': 'wrap',
                        'text-max-width': '80px'
                    }
                },
                {
                    selector: 'node[type="offender"]',
                    style: {
                        'background-color': '#2e303f',
                        'border-color': '#7f5af0',
                        'shape': 'ellipse',
                        'width': '70px',
                        'height': '70px'
                    }
                },
                {
                    selector: 'node[hasAnomaly="true"]',
                    style: {
                        'border-color': '#ff5e62',
                        'border-width': '5px',
                        'background-color': '#4a151b',
                        'content': '⚠️ data(label)'
                    }
                },
                {
                    selector: 'node[type="phone"]',
                    style: {
                        'background-color': '#0f382a',
                        'border-color': '#2cb67d',
                        'shape': 'roundrectangle',
                        'width': '65px',
                        'height': '35px'
                    }
                },
                {
                    selector: 'node[type="alias"]',
                    style: {
                        'background-color': '#3a301a',
                        'border-color': '#ffb515',
                        'shape': 'diamond',
                        'width': '55px',
                        'height': '55px'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 3,
                        'line-color': 'rgba(127, 90, 240, 0.4)',
                        'target-arrow-shape': 'none',
                        'curve-style': 'bezier',
                        'label': 'data(relationship)',
                        'font-size': '9px',
                        'color': '#94a1b2',
                        'text-background-opacity': 0.8,
                        'text-background-color': '#0b0c10',
                        'text-background-padding': '3px',
                        'text-background-shape': 'roundrectangle'
                    }
                },
                {
                    selector: 'edge:selected',
                    style: {
                        'line-color': '#2cb67d',
                        'width': 5
                    }
                }
            ],
            layout: {
                name: 'cose',
                fit: true,
                padding: 40
            }
        });

        // Click handler to open edge explainability records
        cy.on('tap', 'edge', (evt) => {
            const edge = evt.target;
            const ref = edge.data('evidence_ref');
            const records = cyRef.current ? cyRef.current.explainabilityRecords : [];
            
            if (ref) {
                const record = records.find(rec => rec.record_id === ref);
                if (record) {
                    setSelectedEvidence(record);
                } else {
                    setSelectedEvidence({
                        record_id: ref,
                        output_type: 'graph_relation',
                        function_name: 'database-relation',
                        reasoning_summary: `No explainability audit record exists for this link ID in explainability_records. This is a direct database relationship representing a "${edge.data('relationship')}" link.`,
                        source_fir_ids: 'N/A (Schema Derived)',
                        confidence_score: 1.0,
                        verification_status: 'unverified'
                    });
                }
            } else {
                setSelectedEvidence({
                    record_id: `SCHEMA_LINK_${edge.id()}`,
                    output_type: 'graph_relation',
                    function_name: 'database-relation',
                    reasoning_summary: `No explainability audit record exists for this link type. It is dynamically rendered based on the primary keys of the database nodes representing "${edge.data('relationship')}".`,
                    source_fir_ids: 'N/A (Schema Derived)',
                    confidence_score: 1.0,
                    verification_status: 'unverified'
                });
            }
        });

        cyRef.current = cy;
        fetchGraph();

        return () => {
            if (cyRef.current) {
                cyRef.current.destroy();
            }
        };
    }, []);

    const updateCytoscape = (data) => {
        const cy = cyRef.current;
        if (!cy) return;

        // Keep records accessible inside the click handler
        cy.explainabilityRecords = data.explainability_records || [];

        // Clear existing graph elements
        cy.elements().remove();

        const elements = [];

        // 1. Add Offender Nodes
        data.offenders.forEach(off => {
            const hasAnomaly = data.anomaly_flags.some(flag => flag.offender_id === off.offender_id);
            elements.push({
                data: {
                    id: off.offender_id,
                    label: off.full_name,
                    type: 'offender',
                    hasAnomaly: hasAnomaly ? 'true' : 'false'
                }
            });
        });

        // 2. Add Alias Nodes and Links
        data.aliases.forEach(al => {
            elements.push({
                data: {
                    id: al.alias_id,
                    label: al.alias_name,
                    type: 'alias'
                }
            });
            elements.push({
                data: {
                    id: `LINK_${al.alias_id}`,
                    source: al.alias_id,
                    target: al.offender_id,
                    relationship: 'alias_of'
                }
            });
        });

        // 3. Add Phone Nodes
        const phoneNodesAdded = new Set();
        data.phone_links.forEach(pl => {
            if (!phoneNodesAdded.has(pl.phone_id)) {
                elements.push({
                    data: {
                        id: `PHONE_${pl.phone_id}`,
                        label: pl.phone_id,
                        type: 'phone'
                    }
                });
                phoneNodesAdded.add(pl.phone_id);
            }

            elements.push({
                data: {
                    id: `EDGE_PHONE_${pl.offender_id}_${pl.phone_id}`,
                    source: pl.offender_id,
                    target: `PHONE_${pl.phone_id}`,
                    relationship: 'used_phone',
                    evidence_ref: `EVID_PHONE_LINK_${pl.phone_id}`
                }
            });
        });

        // 4. Add Co-Accused Network Edges
        data.network_links.forEach(nl => {
            elements.push({
                data: {
                    id: nl.id,
                    source: nl.offender_id_a,
                    target: nl.offender_id_b,
                    relationship: nl.relationship_type,
                    evidence_ref: `EVID_${nl.id}`
                }
            });
        });

        cy.add(elements);
        
        // Trigger layout repositioning
        const layout = cy.layout({
            name: 'cose',
            animate: true,
            fit: true,
            padding: 50,
            componentSpacing: 120,
            nodeRepulsion: 50000,
            idealEdgeLength: 100
        });
        layout.run();
    };

    const handleVerifyLead = () => {
        if (selectedEvidence) {
            setSelectedEvidence(prev => ({
                ...prev,
                verification_status: 'verified',
                verified_by: 'IO_K_PATEL_5601',
                verification_notes: 'Independently verified network link matching local custody sheet logs.'
            }));
            
            // Re-fetch to update entire UI state
            fetchGraph();
        }
    };

    return (
        <div className="chat-page-container">
            {/* Left Hand Panel: Graph Display canvas */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div>
                        <h3 style={{ margin: '0 0 5px 0' }}>SETU Cross-District Knowledge Graph</h3>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                            Click on any connecting edge to audit its matching evidence trail.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="send-btn" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={fetchGraph}>
                            Refresh
                        </button>
                        <button className="send-btn" style={{ padding: '8px 16px', fontSize: '13px', background: 'var(--accent)' }} onClick={triggerSeed}>
                            {seeding ? 'Seeding...' : 'Load Seed Demo Network'}
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, position: 'relative', minHeight: '520px' }}>
                    {loading && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', color: 'var(--text-muted)', borderRadius: '8px' }}>
                            Building visual network...
                        </div>
                    )}
                    <div 
                        ref={containerRef} 
                        style={{ 
                            width: '100%',
                            height: '100%',
                            position: 'absolute',
                            inset: 0,
                            border: '1px solid rgba(255, 255, 255, 0.05)', 
                            borderRadius: '8px', 
                            background: 'rgba(0,0,0,0.2)'
                        }} 
                    />
                </div>
            </div>

            {/* Right Hand Panel: Explainability Detail Panel */}
            <div className="glass-panel" style={{ height: 'fit-content' }}>
                <h4 className="side-panel-header">Link Explainability</h4>

                {selectedEvidence ? (
                    <div>
                        <div style={{ marginBottom: '15px' }}>
                            <span className="field" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Record ID:</span>
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
                                Verify Link (Sign-off)
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '14px' }}>
                        Click on any edge line in the network graph to inspect its raw verification and linkage details.
                    </div>
                )}
            </div>
        </div>
    );
}
