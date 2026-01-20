import React from "react";

const StudyMaterialsWidget = ({language = 'he', apiUrl = process.env.REACT_APP_STUDY_MATERIALS_API_URL || 'http://localhost:8080'}) => {
  const containerRef = React.useRef(null);
  const widgetInstanceRef = React.useRef(null); // NEW: Track widget instance

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
        script.src = process.env.REACT_APP_STUDY_MATERIALS_WIDGET_URL || 'http://localhost:3000/widget/widget.js';
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
          
          // NEW: load() now returns widget instance with destroy() method
          const widgetInstance = window.StudyMaterialsWidget.load(
            null, // eventId (null = events list)
            language,
            { 
              apiUrl: apiUrl,
              limit: 5,
              target: containerRef.current // Mount in our container
            }
          );
          
          // NEW: Store instance for cleanup
          widgetInstanceRef.current = widgetInstance;
        }
      }, 100);
    };

    initWidget();

    // NEW: Proper cleanup using destroy()
    return () => {
      if (widgetInstanceRef.current && widgetInstanceRef.current.destroy) {
        widgetInstanceRef.current.destroy();
        widgetInstanceRef.current = null;
      }
    };
  }, [language, apiUrl]);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        width: '100%',
        overflow: 'auto',
        backgroundColor: '#fff'
      }}
    />
  );
};

export default StudyMaterialsWidget;