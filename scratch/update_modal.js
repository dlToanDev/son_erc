const fs = require('fs');
const path = 'apps/web/src/components/Modal.tsx';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('window.innerWidth')) {
  code = code.replace(
    "import { X } from 'lucide-react';",
    "import { X } from 'lucide-react';\nimport { useState, useEffect } from 'react';"
  );
  
  const modalHook = `  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);`;
  
  code = code.replace(
    "if (!open) return null;",
    `${modalHook}\n  if (!open) return null;`
  );
  
  code = code.replace(
    "className={`modal modal-${size}`}",
    "className={`modal modal-${size} ${isMobile ? 'modal-sheet' : ''}`}"
  );
  
  fs.writeFileSync(path, code);
}
