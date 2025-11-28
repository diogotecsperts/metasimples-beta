import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [isChecking, setIsChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(true);

  useEffect(() => {
    checkAdminExists();
  }, []);

  const checkAdminExists = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-admin-exists');
      
      if (!error && data) {
        setAdminExists(data.adminExists);
      }
    } catch (error) {
      console.error('Error checking admin:', error);
    } finally {
      setIsChecking(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!adminExists) {
    return <Navigate to="/bootstrap" replace />;
  }

  return <Navigate to="/login" replace />;
};

export default Index;
