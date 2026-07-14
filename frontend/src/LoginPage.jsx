import React, { useState } from 'react';

export default function LoginPage({ onLogin }) {
    const [role, setRole] = useState('investigator');
    const [district, setDistrict] = useState('Tumkur');

    const handleLoginSubmit = (e) => {
        e.preventDefault();
        onLogin({
            authenticated: true,
            username: 'K_PATEL_5601',
            role: role,
            district: district
        });
    };

    return (
        <div style={{ maxWidth: '400px', margin: '100px auto', padding: '30px' }} className="glass-panel">
            <h2 style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--primary-hover)' }}>SETU Platform</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginBottom: '30px' }}>
                Cross-Jurisdictional Criminal Intelligence System
            </p>

            <form onSubmit={handleLoginSubmit}>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                        Investigator Badge ID
                    </label>
                    <input 
                        type="text" 
                        className="chat-input" 
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        defaultValue="K_PATEL_5601"
                        required
                    />
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                        Operational Role (RBAC Scope)
                    </label>
                    <select 
                        className="chat-input" 
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                    >
                        <option value="investigator">Investigator (District-Scoped)</option>
                        <option value="analyst">Analyst (Cross-District Read)</option>
                        <option value="supervisor">Supervisor (Escalation Authority)</option>
                    </select>
                </div>

                <div style={{ marginBottom: '30px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                        District Jurisdiction
                    </label>
                    <select 
                        className="chat-input" 
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                    >
                        <option value="Tumkur">Tumkur</option>
                        <option value="Mysuru">Mysuru</option>
                        <option value="Bengaluru Rural">Bengaluru Rural</option>
                    </select>
                </div>

                <button type="submit" className="send-btn" style={{ width: '100%', padding: '15px 0' }}>
                    Authenticate Securely
                </button>
            </form>

            <div style={{ marginTop: '20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                * Authentication integration mapped locally. Live role validation pending API Gateway console binding.
            </div>
        </div>
    );
}
