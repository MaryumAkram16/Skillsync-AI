import React, { useState, useRef, useEffect } from "react";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Volume1, 
  Maximize, 
  Minimize, 
  RotateCcw, 
  Sparkles, 
  Loader2, 
  Tv, 
  Gauge,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VideoDemoPlayerProps {
  videoSrc?: string;
  title?: string;
  autoplay?: boolean;
  className?: string;
}

export function VideoDemoPlayer({
  videoSrc = "/demos/radar_final.mp4",
  title = "Market Radar Demo",
  autoplay = false,
  className = ""
}: VideoDemoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Video State
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1); // 0 to 1
  const [isMuted, setIsMuted] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [pipActive, setPipActive] = useState(false);

  // Auto-hide controls timer
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Keep element controls showing on mouse movement
  const resetControlsTimeout = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setControlsVisible(false);
        setShowSpeedMenu(false);
      }
    }, 3000);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  // Video Event Handlers
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(err => console.log("Play interrupted: ", err));
      setIsPlaying(true);
    }
    resetControlsTimeout();
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    resetControlsTimeout();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newVolume = parseFloat(e.target.value);
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
    resetControlsTimeout();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const mutedState = !isMuted;
    videoRef.current.muted = mutedState;
    setIsMuted(mutedState);
    resetControlsTimeout();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error("Fullscreen error: ", err));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(err => console.error("Exit fullscreen error: ", err));
    }
    resetControlsTimeout();
  };

  // Fullscreen event listener to sync state with Escape key
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleSpeedSelect = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    resetControlsTimeout();
  };

  const handleRestart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      videoRef.current.play().catch(err => console.log(err));
      setIsPlaying(true);
    }
    resetControlsTimeout();
  };

  const handlePip = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setPipActive(false);
      } else if (videoRef.current.requestPictureInPicture) {
        await videoRef.current.requestPictureInPicture();
        setPipActive(true);
      }
    } catch (e) {
      console.warn("PIP not supported or failed: ", e);
    }
  };

  // Keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only capture keys if mouse is hovering/focused active or in fullscreen
      if (!isFullscreen && document.activeElement !== videoRef.current && document.activeElement !== containerRef.current) {
        return;
      }

      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        handlePlayPause();
      } else if (e.key === "m") {
        e.preventDefault();
        toggleMute();
      } else if (e.key === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, duration, isFullscreen, isMuted]);

  // Sync isPlaying with actually playing video
  useEffect(() => {
    if (videoRef.current) {
      if (autoplay) {
        videoRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  }, [autoplay]);

  const volumePercent = isMuted ? 0 : volume * 100;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      id="video-player-container"
      className={`relative group/player rounded-2xl border border-primary-blue/20 bg-slate-950 overflow-hidden shadow-2xl transition-all duration-300 ${className}`}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => {
        if (isPlaying) {
          setControlsVisible(false);
          setShowSpeedMenu(false);
        }
      }}
      tabIndex={0}
    >
      {/* Top Title Bar (Visible on Hover/Controls Awake) */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            id="video-player-header"
            className="absolute top-0 inset-x-0 z-10 bg-gradient-to-b from-black/85 via-black/50 to-transparent p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary-blue animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-[#00f0ff] font-sans">
                {title}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-text-secondary font-mono bg-primary-blue/10 border border-primary-blue/30 px-2 py-0.5 rounded-full">
              <Activity className="h-3 w-3 text-primary-blue" />
              <span>LIVE FEED</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Video Screen */}
      <div 
        id="video-screen-click-target"
        className="relative w-full h-full aspect-video cursor-pointer flex items-center justify-center bg-slate-900"
        onClick={handlePlayPause}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          playsInline
          loop
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={() => setIsWaiting(true)}
          onPlaying={() => setIsWaiting(false)}
        />

        {/* Loading Spinner */}
        {isWaiting && (
          <div id="video-waiting-loader" className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
            <Loader2 className="h-10 w-10 text-primary-blue animate-spin" />
          </div>
        )}

        {/* Center Hover/Click Trigger Play-Pause Indicator Overlay */}
        <AnimatePresence>
          {!isPlaying && !isWaiting && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              id="video-overlay-play-btn"
              className="absolute h-16 w-16 rounded-full bg-[#00f0ff]/10 backdrop-blur-md flex items-center justify-center border border-[#00f0ff]/40 shadow-[0_0_20px_rgba(0,240,255,0.2)] hover:scale-110 active:scale-95 transition-transform z-10"
            >
              <Play className="h-6 w-6 text-[#00f0ff] fill-[#00f0ff] translate-x-0.5" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Custom Controls Controls */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            id="video-player-controls"
            className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-8 flex flex-col gap-3"
          >
            {/* Custom Timeline Area */}
            <div id="video-timeline-wrapper" className="group/timeline flex flex-col gap-1">
              <div className="relative flex items-center w-full">
                {/* Background Track */}
                <div className="absolute left-0 right-0 h-1 bg-white/20 rounded-full overflow-hidden">
                  {/* Filled Track indicator bar */}
                  <div 
                    className="h-full bg-gradient-to-r from-primary-blue to-primary-purple"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                
                {/* Real HTML5 seeking range input overlay */}
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeekChange}
                  id="video-timeline-slider"
                  className="w-full h-4 opacity-0 cursor-pointer absolute z-20 left-0 right-0"
                />

                {/* Styled slider handle knob */}
                <div
                  className="absolute h-3 w-3 rounded-full bg-white border-2 border-primary-blue shadow-lg -translate-x-1/2 pointer-events-none transition-transform group-hover/timeline:scale-125 duration-150 z-10"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>
              
              {/* Timing label indicator */}
              <div className="flex justify-between text-[11px] font-mono text-text-secondary mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Action Buttons Container */}
            <div id="video-actions-wrapper" className="flex items-center justify-between">
              {/* Left section: Play, restart, volume */}
              <div className="flex items-center gap-3">
                <button
                  id="video-btn-play-pause"
                  onClick={handlePlayPause}
                  className="p-1.5 focus:outline-none text-white hover:text-primary-blue transition-colors rounded-lg bg-white/5 border border-white/10 hover:border-primary-blue/35 hover:scale-105 active:scale-95"
                  title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                >
                  {isPlaying ? (
                    <Pause className="h-4.5 w-4.5" />
                  ) : (
                    <Play className="h-4.5 w-4.5 fill-current" />
                  )}
                </button>

                <button
                  id="video-btn-replay"
                  onClick={handleRestart}
                  className="p-1.5 focus:outline-none text-white hover:text-primary-blue transition-colors rounded-lg bg-white/5 border border-white/10 hover:border-primary-blue/35"
                  title="Replay"
                >
                  <RotateCcw className="h-4.5 w-4.5" />
                </button>

                {/* Volume section */}
                <div id="video-volume-section" className="flex items-center gap-1.5 group/volume ml-1">
                  <button
                    id="video-btn-mute"
                    onClick={toggleMute}
                    className="p-1.5 focus:outline-none text-white hover:text-primary-blue transition-colors rounded-lg bg-white/5 border border-white/15"
                    title={isMuted ? "Unmute (M)" : "Mute (M)"}
                  >
                    {isMuted ? (
                      <VolumeX className="h-4.5 w-4.5 text-danger" />
                    ) : volumePercent > 50 ? (
                      <Volume2 className="h-4.5 w-4.5" />
                    ) : (
                      <Volume1 className="h-4.5 w-4.5" />
                    )}
                  </button>

                  <div className="relative hidden md:flex items-center w-0 overflow-hidden group-hover/volume:w-20 group-hover/volume:ml-1 transition-all duration-300">
                    <div className="relative flex items-center w-full">
                      <div className="absolute left-0 right-0 h-1 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary-blue"
                          style={{ width: `${volumePercent}%` }}
                        />
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        id="video-volume-slider"
                        className="w-full h-3 opacity-0 cursor-pointer absolute z-20"
                      />
                      <div
                        className="absolute h-2 w-2 rounded-full bg-white border border-primary-blue shadow -translate-x-1/2 pointer-events-none"
                        style={{ left: `${volumePercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right section: PIP, Speed, Fullscreen */}
              <div className="flex items-center gap-2">
                {/* PIP Button */}
                <button
                  id="video-btn-pip"
                  onClick={handlePip}
                  className="p-1.5 focus:outline-none text-white hover:text-primary-blue transition-colors rounded-lg bg-white/5 border border-white/10"
                  title="Picture in Picture"
                >
                  <Tv className="h-4.5 w-4.5" />
                </button>

                {/* Speed Controls Menu Toggle */}
                <div className="relative">
                  <button
                    id="video-btn-speed"
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className={`p-1.5 focus:outline-none text-white hover:text-primary-blue transition-colors rounded-lg bg-white/5 border border-white/10 flex items-center gap-1 ${showSpeedMenu ? 'border-primary-blue/40 text-primary-blue' : ''}`}
                    title="Playback speed"
                  >
                    <Gauge className="h-4.5 w-4.5" />
                    <span className="text-[10px] font-mono leading-none">{playbackRate}x</span>
                  </button>

                  {/* Playback speed menu */}
                  <AnimatePresence>
                    {showSpeedMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        id="video-speed-menu"
                        className="absolute bottom-full right-0 mb-2 w-24 bg-slate-900 border border-white/15 rounded-xl shadow-xl overflow-hidden py-1 z-30"
                      >
                        {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            id={`video-speed-option-${rate}`}
                            onClick={() => handleSpeedSelect(rate)}
                            className={`w-full text-left px-3 py-1 text-xs font-mono transition-colors hover:bg-white/10 ${playbackRate === rate ? 'text-[#00f0ff] font-bold bg-white/5' : 'text-text-secondary hover:text-white'}`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Fullscreen Button */}
                <button
                  id="video-btn-fullscreen"
                  onClick={toggleFullscreen}
                  className="p-1.5 focus:outline-none text-white hover:text-primary-blue transition-colors rounded-lg bg-white/5 border border-white/10"
                  title="Toggle Fullscreen (F)"
                >
                  {isFullscreen ? (
                    <Minimize className="h-4.5 w-4.5" />
                  ) : (
                    <Maximize className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
