import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-left">
          <div className="footer-logo">
            <h2 className="logo">
              <span className="logo-text">STAN</span>
              <span className="logo-highlight">D</span>
              <span className="logo-text">OFF 2</span>
            </h2>
            <p className="footer-tagline">
              Competitive <span className="tagline-highlight">Hub</span>
            </p>
          </div>

          <nav className="footer-nav">
            <a href="#" className="footer-link">About</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Support</a>
          </nav>
        </div>

        <div className="footer-right">
          <div className="social-links">
            <a href="#" className="social-link" aria-label="Twitter">🐦</a>
            <a href="#" className="social-link" aria-label="Discord">💬</a>
            <a href="#" className="social-link" aria-label="YouTube">▶️</a>
            <a href="#" className="social-link" aria-label="Instagram">📷</a>
          </div>
          <p className="footer-powered">Powered by Standoff 2 API</p>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="copyright">© 2024 Standoff 2 Competitive Hub. All rights reserved.</p>
        <p className="footer-powered-bottom">Powered by Standoff 2 API</p>
      </div>
    </footer>
  );
}

