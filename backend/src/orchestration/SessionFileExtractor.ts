/**
 * Session File Extractor
 * Extracts output files from messages
 */

export class SessionFileExtractor {
    /**
     * Extract output files from message
     * First tries to get files from instructContent (for WriteCode action),
     * then falls back to parsing content
     */
    static extractOutputFiles(message: any): Array<{ path: string; content: string }> {
        // Check if message has instructContent with files (from WriteCode action)
        if (message.instructContent && message.instructContent.files && Array.isArray(message.instructContent.files)) {
            return message.instructContent.files.map((f: any) => ({
                path: f.path || f,
                content: f.content || '',
            }));
        }

        // Fallback: parse files from content (simple heuristic)
        const files: Array<{ path: string; content: string }> = [];
        const content = message.content;

        // Look for markdown code blocks with file paths
        const filePattern = /```[\w]*:?([\w/\-.]+)\n([\s\S]*?)```/g;
        let match;

        while ((match = filePattern.exec(content)) !== null) {
            if (match[1]) {
                files.push({
                    path: match[1],
                    content: match[2] || '',
                });
            }
        }

        // Look for "Generated files:" sections
        const generatedPattern = /Generated files?:\s*\n([\s\S]*?)(?:\n\n|$)/i;
        const generatedMatch = content.match(generatedPattern);

        if (generatedMatch) {
            const fileList = generatedMatch[1];
            const fileLines = fileList.split('\n');

            fileLines.forEach((line: string) => {
                const fileMatch = line.match(/[-*]\s+([\w/\-.]+)/);
                if (fileMatch) {
                    // Check if we already have this file
                    if (!files.find(f => f.path === fileMatch[1])) {
                        files.push({
                            path: fileMatch[1],
                            content: '',
                        });
                    }
                }
            });
        }

        // Remove duplicates based on path
        const uniqueFiles = new Map<string, { path: string; content: string }>();
        files.forEach(f => {
            if (!uniqueFiles.has(f.path) || f.content) {
                uniqueFiles.set(f.path, f);
            }
        });

        return Array.from(uniqueFiles.values());
    }
}

