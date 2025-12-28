import React from "react";

const StudyMaterialsWidget = ({language = 'he', apiUrl = 'http://localhost:8080'}) => {
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    // Load the widget script if not already loaded
    const loadScript = () => {
      return new Promise((resolve) => {
        const existingScript = document.querySelector('script[src*="widget.js"]');
        if (existingScript) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'http://localhost:3000/widget/widget.js';
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
      });
    };

    // Initialize widget using the exposed load() method
    const initWidget = async () => {
      await loadScript();
      
      // Small delay to ensure script is fully executed
      setTimeout(() => {
        if (containerRef.current && window.StudyMaterialsWidget && window.StudyMaterialsWidget.load) {
          // Clear existing content
          containerRef.current.innerHTML = '';
          
          // Use the widget's load() method to create and initialize
          const widgetContainer = window.StudyMaterialsWidget.load(
            null, // eventId
            language,
            { 
              apiBaseUrl: apiUrl,
              limit: 10,
              container: containerRef.current // Pass our container
            }
          );
          
          // If load() returns a container, make sure it's in our ref
          if (widgetContainer && widgetContainer !== containerRef.current) {
            containerRef.current.innerHTML = '';
            containerRef.current.appendChild(widgetContainer);
          }
        }
      }, 100);
    };

    initWidget();

    // Cleanup
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [language, apiUrl]);

  return (
    <div
      ref={containerRef}
      style={{
        height: 'calc(100vh - 140px)',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: '#fff'
      }}
    />
  );
};

export default StudyMaterialsWidget;
