import React, { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

export default function AnalyticsPage() {
    const barChartRef = useRef(null);
    const pieChartRef = useRef(null);
    const barChartInstance = useRef(null);
    const pieChartInstance = useRef(null);

    const [stats, setStats] = useState({
        totalCases: 0,
        totalOffenders: 0,
        totalAnomalies: 0,
        crimeTypes: {},
        districts: {},
        riskCategories: { Low: 0, Medium: 0, High: 0 }
    });
    const [loading, setLoading] = useState(true);

    const loadAnalyticsData = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5001/api/get-graph');
            const data = await res.json();
            if (data.status === 'success') {
                const firList = data.firs || [];
                const offenderList = data.offenders || [];
                const anomalyList = data.anomaly_flags || [];

                // 1. Group cases by crime type
                const crimeTypes = {};
                firList.forEach(f => {
                    crimeTypes[f.crime_type] = (crimeTypes[f.crime_type] || 0) + 1;
                });

                // 2. Group cases by district
                const districts = {};
                firList.forEach(f => {
                    const dist = f.district_id || 'Unknown';
                    districts[dist] = (districts[dist] || 0) + 1;
                });

                // 3. Group offenders by risk category
                const riskCategories = { Low: 0, Medium: 0, High: 0 };
                offenderList.forEach(o => {
                    const score = o.risk_score;
                    if (score === null || score === undefined) {
                        riskCategories.Low++; // Fallback/default to uncalculated
                    } else if (score >= 0.70) {
                        riskCategories.High++;
                    } else if (score >= 0.40) {
                        riskCategories.Medium++;
                    } else {
                        riskCategories.Low++;
                    }
                });

                setStats({
                    totalCases: firList.length,
                    totalOffenders: offenderList.length,
                    totalAnomalies: anomalyList.length,
                    crimeTypes,
                    districts,
                    riskCategories
                });

                renderCharts(crimeTypes, riskCategories);
            }
        } catch (e) {
            console.error("Failed to load analytics:", e);
        } finally {
            setLoading(false);
        }
    };

    const renderCharts = (crimeTypesData, riskData) => {
        // Destroy existing instances if reloading
        if (barChartInstance.current) barChartInstance.current.destroy();
        if (pieChartInstance.current) pieChartInstance.current.destroy();

        // 1. Bar Chart: Incidents by Crime Type
        if (barChartRef.current) {
            const ctx = barChartRef.current.getContext('2d');
            barChartInstance.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: Object.keys(crimeTypesData).map(k => k.replace('-', ' ')),
                    datasets: [{
                        label: 'Active Incident Count',
                        data: Object.values(crimeTypesData),
                        backgroundColor: 'rgba(127, 90, 240, 0.4)',
                        borderColor: '#7f5af0',
                        borderWidth: 2,
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#94a1b2', stepSize: 1 }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#94a1b2' }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }

        // 2. Pie Chart: Offender Risk Category Distribution
        if (pieChartRef.current) {
            const ctx = pieChartRef.current.getContext('2d');
            pieChartInstance.current = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: Object.keys(riskData),
                    datasets: [{
                        data: Object.values(riskData),
                        backgroundColor: [
                            'rgba(44, 182, 125, 0.4)',  // Low
                            'rgba(255, 181, 21, 0.4)',   // Medium
                            'rgba(255, 94, 98, 0.4)'     // High
                        ],
                        borderColor: [
                            '#2cb67d',
                            '#ffb515',
                            '#ff5e62'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#94a1b2', boxWidth: 12 }
                        }
                    }
                }
            });
        }
    };

    useEffect(() => {
        loadAnalyticsData();

        return () => {
            if (barChartInstance.current) barChartInstance.current.destroy();
            if (pieChartInstance.current) pieChartInstance.current.destroy();
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {/* Top KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' }}>
                <div className="glass-panel" style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Cases</div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--primary-hover)', marginTop: '5px' }}>{stats.totalCases}</div>
                </div>
                <div className="glass-panel" style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Indexed Suspects</div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--accent)', marginTop: '5px' }}>{stats.totalOffenders}</div>
                </div>
                <div className="glass-panel" style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Anomaly Flags</div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-red)', marginTop: '5px' }}>{stats.totalAnomalies}</div>
                </div>
            </div>

            {/* Graphs Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', minHeight: '400px' }}>
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Incident Distribution by Crime Classification</h3>
                    <div style={{ flex: 1, position: 'relative', minHeight: '300px' }}>
                        {loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                Compiling metrics...
                            </div>
                        ) : Object.keys(stats.crimeTypes).length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                No active cases in the database to aggregate.
                            </div>
                        ) : (
                            <canvas ref={barChartRef} />
                        )}
                    </div>
                </div>

                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Suspect Risk Class Allocations</h3>
                    <div style={{ flex: 1, position: 'relative', minHeight: '300px' }}>
                        {loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                Compiling metrics...
                            </div>
                        ) : stats.totalOffenders === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                No suspects indexed.
                            </div>
                        ) : (
                            <canvas ref={pieChartRef} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
