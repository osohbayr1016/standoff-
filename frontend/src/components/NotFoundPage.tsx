import './NotFoundPage.css';

interface NotFoundPageProps {
  onGoHome: () => void;
}

export default function NotFoundPage({ onGoHome }: NotFoundPageProps) {
  return (
    <div className="not-found-page">
      <div className="not-found-background"></div>
      
      <div className="not-found-content">
        <div className="not-found-left">
          <h1 className="error-code">404</h1>
          <h2 className="error-title">Page Not Found</h2>
          <p className="error-message">
            Looks like you've gone off-map.<br />
            This page doesn't exist.
          </p>
          <button className="go-home-btn" onClick={onGoHome}>
            Go Back Home
          </button>
        </div>

        <div className="not-found-character">
          <img 
            src="/Gemini_Generated_Image_2odldz2odldz2odl.png" 
            alt="Standoff 2 Character" 
            className="character-image"
          />
        </div>
      </div>

      <div className="not-found-header">
        <div className="header-logo">
          <span className="logo-text">STAN</span>
          <span className="logo-highlight">D</span>
          <span className="logo-text">OFF 2</span>
        </div>
        <p className="header-tagline">COMPETITIVE HUB</p>
        
        <nav className="header-nav">
          <span className="nav-item active">Home</span>
          <span className="nav-item">About</span>
          <span className="nav-item">Events</span>
          <span className="nav-item">Reports</span>
          <span className="nav-item">Links</span>
          <span className="nav-item">Contact</span>
        </nav>
      </div>
    </div>
  );
}

