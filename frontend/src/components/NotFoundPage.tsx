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
          <h2 className="error-title">Хуудас олдсонгүй</h2>
          <p className="error-message">
            Та газрын зурагнаас гадуур явсан бололтой.<br />
            Энэ хуудас байхгүй байна.
          </p>
          <button className="go-home-btn" onClick={onGoHome}>
            Нүүр хуудас руу буцах
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
        <p className="header-tagline">ТЭМЦЭЭНИЙ ТӨВ</p>
        
        <nav className="header-nav">
          <span className="nav-item active">Нүүр</span>
          <span className="nav-item">Бидний тухай</span>
          <span className="nav-item">Үйл явдал</span>
          <span className="nav-item">Тайлан</span>
          <span className="nav-item">Холбоос</span>
          <span className="nav-item">Холбоо барих</span>
        </nav>
      </div>
    </div>
  );
}

