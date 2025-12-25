import "./Footer.css";

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
              Тэмцээний <span className="tagline-highlight">Төв</span>
            </p>
          </div>

          <nav className="footer-nav">
            <a href="#" className="footer-link">
              Бидний тухай
            </a>
            <a href="#" className="footer-link">
              Үйлчилгээний нөхцөл
            </a>
            <a href="#" className="footer-link">
              Нууцлалын бодлого
            </a>
            <a href="#" className="footer-link">
              Дэмжлэг
            </a>
          </nav>
        </div>

        <div className="footer-right">
          <div className="social-links">
            <a href="#" className="social-link" aria-label="Twitter">
              🐦
            </a>
            <a href="#" className="social-link" aria-label="Discord">
              💬
            </a>
            <a href="#" className="social-link" aria-label="YouTube">
              ▶️
            </a>
            <a href="#" className="social-link" aria-label="Instagram">
              📷
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="copyright">2 найз 2 хоногт хийж гүйцэтгэв.</p>
        <p className="footer-powered-bottom">Standoff 2 хөгжихийн төлөө.</p>
      </div>
    </footer>
  );
}
