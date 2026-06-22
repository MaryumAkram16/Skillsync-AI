import { useMemo } from "react";
import { BookOpen, Video, GraduationCap, Github, ExternalLink } from "lucide-react";
import { ResourcesData } from "../utils/roadmapTypes";
import { getItemLabel, getItemUrl } from "../utils/roadmapHelpers";

/**
 * Extracted from roadmap.tsx — takes only the `data` prop, no shared
 * state with the page.
 */
export function ResourcesSection({ data }: { data: ResourcesData }) {
  const phases = useMemo(() => {
    if (Array.isArray(data?.phases)) return data.phases;
    return [];
  }, [data]);

  if (phases.length === 0) {
    return (
      <div className="p-4 sm:p-6 md:p-8 text-center rounded-xl md:rounded-[4rem] bg-bg-card border border-dashed border-border group">
        <BookOpen className="h-16 w-16 sm:h-20 sm:w-20 text-text-secondary/20 mx-auto mb-8 group-hover:scale-110 transition-transform" />
        <p className="font-display text-xl sm:text-2xl font-semibold text-text-heading tracking-tight uppercase">
          No Resources Available
        </p>
        <p className="text-sm sm:text-base text-text-secondary mt-4 max-w-md mx-auto italic">
          We couldn't index curated resources for this roadmap yet. Try again in a
          moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {phases.map((phase, idx) => {
        const videos = phase.videos ?? [];
        const courses = phase.courses ?? [];
        const github = phase.github ?? [];
        const articles = phase.articles ?? [];
        const hasAnything =
          videos.length + courses.length + github.length + articles.length > 0;
        if (!hasAnything) return null;

        return (
          <div
            key={idx}
            className="space-y-8 p-8 rounded-[3rem] bg-bg-card border border-border shadow-xl"
          >
            <div className="flex items-center gap-4 pb-4 border-b border-border">
              <div className="w-14 h-14 rounded-2xl bg-primary-blue/10 text-primary-blue flex items-center justify-center font-black text-lg">
                {phase.phase_number ?? idx + 1}
              </div>
              <h4 className="font-display text-2xl font-semibold text-text-heading uppercase tracking-tight">
                {phase.phase_name}
              </h4>
            </div>

            {videos.length > 0 && (
              <div className="space-y-6">
                <h5 className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-500 flex items-center gap-2 px-4 border-l-4 border-red-500">
                  <Video className="h-3.5 w-3.5" /> Video Tutorials
                </h5>
                <div className="grid gap-4 md:grid-cols-2">
                  {videos.map((video, i) => (
                    <a
                      key={i}
                      href={getItemUrl(video)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-6 rounded-3xl bg-card border border-border shadow-sm hover:shadow-xl hover:border-red-500/20 transition-all flex gap-4 group"
                    >
                      <div className="p-4 rounded-2xl bg-red-500/10 text-red-500 h-fit group-hover:bg-red-500 group-hover:text-white transition-colors">
                        <Video className="h-6 w-6" />
                      </div>
                      <div className="space-y-2 min-w-0">
                        <h6 className="font-display text-base font-semibold text-text-primary leading-tight group-hover:text-red-500 line-clamp-2">
                          {getItemLabel(video)}
                        </h6>
                        <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-text-secondary tracking-widest flex-wrap">
                          {video.channel && <span>📺 {video.channel}</span>}
                          {video.views && <span>· {video.views}</span>}
                          {video.duration && <span>· {video.duration}</span>}
                        </div>
                        {video.why && (
                          <p className="text-xs text-text-secondary italic line-clamp-2">
                            {video.why}
                          </p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {courses.length > 0 && (
              <div className="space-y-6">
                <h5 className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary-blue flex items-center gap-2 px-4 border-l-4 border-primary-blue">
                  <GraduationCap className="h-3.5 w-3.5" /> Courses
                </h5>
                <div className="grid gap-4 md:grid-cols-2">
                  {courses.map((course, i) => (
                    <a
                      key={i}
                      href={getItemUrl(course)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-6 rounded-3xl bg-card border border-border shadow-sm hover:shadow-xl hover:shadow-primary-blue/5 hover:border-primary-blue/20 transition-all flex gap-4 group"
                    >
                      <div className="p-4 rounded-2xl bg-primary-blue/10 text-primary-blue h-fit group-hover:bg-primary-blue group-hover:text-white transition-colors">
                        <GraduationCap className="h-6 w-6" />
                      </div>
                      <div className="space-y-2 min-w-0">
                        <h6 className="font-display text-base font-semibold text-text-primary leading-tight group-hover:text-primary-blue line-clamp-2">
                          {getItemLabel(course)}
                        </h6>
                        {course.platform && (
                          <div className="font-mono text-[10px] uppercase text-text-secondary tracking-widest">
                            Platform: {course.platform}
                          </div>
                        )}
                        {course.description && (
                          <p className="text-xs text-text-secondary font-medium line-clamp-2">
                            {course.description}
                          </p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {github.length > 0 && (
              <div className="space-y-6">
                <h5 className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-primary flex items-center gap-2 px-4 border-l-4 border-text-primary">
                  <Github className="h-3.5 w-3.5" /> GitHub Resources
                </h5>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {github.map((repo, i) => (
                    <a
                      key={i}
                      href={getItemUrl(repo)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-6 rounded-3xl bg-tag-bg text-white shadow-xl hover:translate-y-[-4px] transition-all flex flex-col group border border-border"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <Github className="h-6 w-6 text-tag-text/60 group-hover:text-tag-text transition-colors" />
                        {repo.starsLabel && (
                          <div className="text-[10px] font-black bg-white/10 px-2 py-1 rounded text-tag-text">
                            ⭐ {repo.starsLabel}
                          </div>
                        )}
                      </div>
                      <h6 className="font-display text-sm font-semibold mb-2 line-clamp-1 group-hover:text-primary-purple transition-colors">
                        {repo.fullName || getItemLabel(repo)}
                      </h6>
                      {repo.description && (
                        <p className="text-[10px] text-white/50 line-clamp-2 mb-4 italic leading-relaxed">
                          {repo.description}
                        </p>
                      )}
                      {repo.language && (
                        <div className="mt-auto flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-purple" />
                          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                            {repo.language}
                          </span>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {articles.length > 0 && (
              <div className="space-y-6">
                <h5 className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary-purple flex items-center gap-2 px-4 border-l-4 border-primary-purple">
                  <BookOpen className="h-3.5 w-3.5" /> Articles & Guides
                </h5>
                <div className="grid gap-3">
                  {articles.map((article, i) => (
                    <a
                      key={i}
                      href={getItemUrl(article)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-5 border border-border rounded-2xl bg-card hover:bg-background transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-primary-purple mb-1">
                          {article.source || "Article"}
                          {article.date && (
                            <span className="text-text-secondary">· {article.date}</span>
                          )}
                        </div>
                        <h6 className="text-sm font-bold text-text-primary group-hover:text-primary-purple line-clamp-1">
                          {getItemLabel(article)}
                        </h6>
                      </div>
                      <ExternalLink className="h-4 w-4 text-text-secondary group-hover:text-primary-purple transition-all shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}