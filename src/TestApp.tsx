const TestApp = () => {
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f0f0f0', 
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ color: 'red', fontSize: '24px', marginBottom: '10px' }}>
          🚀 BASIC TEST - React is Working! 🚀
        </h1>
        <p style={{ color: 'blue', marginBottom: '10px' }}>
          Date: {new Date().toLocaleString()}
        </p>
        <p style={{ color: 'green', marginBottom: '15px' }}>
          ✅ If you can see this, React is rendering correctly!
        </p>
        <button 
          onClick={() => alert('JavaScript works!')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Click me to test JavaScript
        </button>
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#e8f5e8',
          borderRadius: '4px',
          border: '1px solid #4caf50'
        }}>
          <h3 style={{ color: '#2e7d32', margin: '0 0 10px 0' }}>Next Steps:</h3>
          <p style={{ margin: 0, color: '#1b5e20' }}>
            If this works, the issue is with the App component or its dependencies.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestApp;
