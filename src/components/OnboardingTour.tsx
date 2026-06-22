import React, { useState, useEffect } from 'react';
import { EventData, STATUS, Step, Joyride as JoyrideComponent } from 'react-joyride';

export function OnboardingTour({ restartKey }: { restartKey?: number }) {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const hasSeenTour = sessionStorage.getItem('hasSeenTour');
    if (!hasSeenTour || restartKey) {
      sessionStorage.setItem('hasSeenTour', 'true');
      // Small delay to ensure the DOM elements are rendered
      const timer = setTimeout(() => {
        setRun(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [restartKey]);

  const steps: Step[] = [
    {
      target: 'body',
      content: 'Welcome to SkillSync AI! Let\'s take a quick tour of your new career growth platform.',
      placement: 'center',
      skipBeacon: true,
    },
    {
      target: '[data-tour="nav-skill-assessment"]',
      content: 'Start here to evaluate your current skills with an AI-driven quiz.',
      placement: 'right',
    },
    {
      target: '[data-tour="nav-career-mentor"]',
      content: 'Get personalized career path recommendations based on your unique skill profile.',
      placement: 'right',
    },
    {
      target: '[data-tour="nav-resume-tools"]',
      content: 'Upload and parse your resume to instantly update your skill profile.',
      placement: 'right',
    },
    {
      target: '[data-tour="nav-interview-preparation"]',
      content: 'Ready to land the job? Practice with AI mock interviews and curated questions.',
      placement: 'right',
    },
  ];

  const handleJoyrideCallback = (data: EventData) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      sessionStorage.setItem('hasSeenTour', 'true');
    }
  };

  return (
    <JoyrideComponent
      steps={steps}
      run={run}
      continuous={true}
      options={{
        primaryColor: '#3b82f6',
        textColor: '#f1f5f9',
        backgroundColor: '#1e293b',
        arrowColor: '#1e293b',
        overlayColor: 'rgba(0, 0, 0, 0.7)',
        showProgress: true,
        buttons: ['back', 'close', 'primary', 'skip'],
      }}
      onEvent={handleJoyrideCallback}
      styles={{
        buttonClose: {
          color: '#94a3b8',
        },
        buttonSkip: {
          color: '#94a3b8',
        },
        buttonBack: {
          color: '#94a3b8',
        },
      }}
    />
  );
}
