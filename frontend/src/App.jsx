import React, { useState } from 'react';
const AppCss = import.meta.env ? '' : require('./App.css'); // Avoid loading default App.css
import LoginPage from './LoginPage';
import ChatPage from './ChatPage';
import NetworkGraphPage from './NetworkGraphPage';
import HotspotMapPage from './HotspotMapPage';
import AnalyticsPage from './AnalyticsPage';

export default function App() {
    const [auth, setAuth] = useState({
        authenticated: false,
        username: '',
        role: '',
        district: ''
    });
    
    const [currentTab, setCurrentTab] = useState('chat');

    const handleLogin = (authDetails) => {
        setAuth(authDetails);
    };

    const handleLogout = () => {
        setAuth({
            authenticated: false,
            username: '',
            role: '',
            district: ''
        });
    };

    // If not authenticated, force the Login page
    if (!auth.authenticated) {
        return <LoginPage onLogin={handleLogin} />;
    }

    return (
        <div className="app-container">
            {/* Sticky glassmorphic dashboard header */}
            <header className="main-header">
                <div className="logo-section">
                    <h1>SETU</h1>
                    <p>Criminal Network Analytics</p>
                </div>

                <nav className="main-nav">
                    <button 
                        className={`nav-tab ${currentTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setCurrentTab('chat')}
                    >
                        Conversational Search
                    </button>
                    <button 
                        className={`nav-tab ${currentTab === 'graph' ? 'active' : ''}`}
                        onClick={() => setCurrentTab('graph')}
                    >
                        Network Graph
                    </button>
                    <button 
                        className={`nav-tab ${currentTab === 'map' ? 'active' : ''}`}
                        onClick={() => setCurrentTab('map')}
                    >
                        Hotspot Map
                    </button>
                    <button 
                        className={`nav-tab ${currentTab === 'analytics' ? 'active' : ''}`}
                        onClick={() => setCurrentTab('analytics')}
                    >
                        Analytics
                    </button>
                </nav>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{auth.username}</div>
                        <div style={{ fontSize: '10px', color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 600 }}>
                            {auth.role} ({auth.district})
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout}
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--text-muted)',
                            borderRadius: '5px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Dynamic tab contents */}
            <main className="main-content">
                {currentTab === 'chat' && <ChatPage />}
                
                {currentTab === 'graph' && <NetworkGraphPage />}

                {currentTab === 'map' && <HotspotMapPage />}

                {currentTab === 'analytics' && <AnalyticsPage />}
            </main>
        </div>
    );
}
