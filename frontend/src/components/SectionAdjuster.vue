<template>
    <div class="section-adjuster">
        <el-divider content-position="left">
            <el-icon>
                <Document />
            </el-icon>
            章节调整
            <span v-if="sections.length > 0"> ({{ sections.length }})</span>
            <span v-else style="color: #909399; font-size: 12px; margin-left: 8px;">
                (正在解析章节...)
            </span>
        </el-divider>

        <div v-if="sections.length > 0" class="sections-list">
            <el-tag v-for="section in sections" :key="section.number" class="section-tag"
                :type="selectedSectionNumber === section.number ? 'primary' : 'info'"
                :effect="selectedSectionNumber === section.number ? 'dark' : 'plain'"
                @click="selectSection(section.number)" style="cursor: pointer; margin-right: 8px; margin-bottom: 8px;">
                {{ section.number }}. {{ section.title }}
            </el-tag>
        </div>

        <div v-else class="sections-empty">
            <el-alert type="info" :closable="false" show-icon>
                <template #title>
                    <span>未检测到章节结构，请确保内容包含 "## 数字. 标题" 格式的章节</span>
                </template>
            </el-alert>
        </div>

        <div v-if="sections.length > 0" style="margin-top: 12px;">
            <el-button v-if="selectedSectionNumber !== null" type="primary" size="small" :icon="ChatLineRound"
                @click="openSectionAdjustDialog">
                调整章节 {{ selectedSectionNumber }}
            </el-button>
            <span v-else style="display: block; margin-top: 8px; color: #909399; font-size: 12px;">
                请先选择一个章节
            </span>
        </div>

        <!-- Section Adjust Dialog -->
        <el-dialog v-model="showSectionDialog" :title="`调整章节 ${selectedSectionNumber}: ${selectedSectionTitle}`"
            width="80%" :close-on-click-modal="false">
            <div class="section-adjust-dialog">
                <div class="section-original">
                    <h4>原始内容：</h4>
                    <el-scrollbar max-height="300px">
                        <pre class="section-content">{{ selectedSectionContent }}</pre>
                    </el-scrollbar>
                </div>
                <div class="section-adjust">
                    <h4>调整要求：</h4>
                    <el-input v-model="sectionAdjustRequest" type="textarea" :rows="6"
                        placeholder="请描述您希望如何调整这个章节的内容，例如：&#10;- 添加更多细节&#10;- 修改某个功能描述&#10;- 补充验收标准等" />
                </div>
            </div>
            <template #footer>
                <el-button @click="showSectionDialog = false">取消</el-button>
                <el-button type="primary" @click="handleSectionAdjust" :loading="sectionAdjustLoading">
                    确认调整
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Document, ChatLineRound } from '@element-plus/icons-vue';
import { apiClient } from '../api/client';

interface Section {
    number: number;
    title: string;
    content?: string;
}

interface Props {
    content: string;
    documentType?: 'PRD' | 'REQUIREMENT' | 'DESIGN' | 'OTHER';
    action?: string;
    projectId?: string;
    documentId?: string;
    onSectionAdjusted?: (sectionNumber: number, newContent: string) => void;
}

const props = withDefaults(defineProps<Props>(), {
    documentType: 'OTHER',
    action: '',
    projectId: '',
    documentId: '',
});

const sections = ref<Section[]>([]);
const selectedSectionNumber = ref<number | null>(null);
const showSectionDialog = ref(false);
const sectionAdjustRequest = ref('');
const sectionAdjustLoading = ref(false);

const selectedSectionTitle = computed(() => {
    if (selectedSectionNumber.value === null) return '';
    const section = sections.value.find(s => s.number === selectedSectionNumber.value);
    return section?.title || '';
});

const selectedSectionContent = computed(() => {
    if (selectedSectionNumber.value === null) return '';
    const section = sections.value.find(s => s.number === selectedSectionNumber.value);
    return section?.content || '';
});

// Parse sections from content
function parseSections(content: string): Section[] {
    const sections: Section[] = [];
    if (!content || content.trim().length === 0) {
        return sections;
    }

    const lines = content.split('\n');
    let currentSection: Section | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match section headers: ## X. Title (more flexible - allow spaces before ##)
        const match = line.match(/^##\s+(\d+)\.\s+(.+)$/);

        if (match) {
            // Save previous section
            if (currentSection) {
                if (currentSection.content) {
                    currentSection.content = currentSection.content.trim();
                }
                sections.push(currentSection);
            }

            // Start new section
            currentSection = {
                number: parseInt(match[1], 10),
                title: match[2].trim(),
                content: '',
            };
        } else if (currentSection) {
            // Skip separator lines (---) and empty lines at section start
            const trimmedLine = line.trim();
            if (trimmedLine === '---' || trimmedLine === '') {
                if (!currentSection.content || currentSection.content.trim().length === 0) {
                    continue;
                }
            }

            // Add line to current section content
            if (!currentSection.content) {
                currentSection.content = '';
            }
            currentSection.content += line + '\n';
        }
    }

    // Don't forget the last section
    if (currentSection) {
        if (currentSection.content) {
            currentSection.content = currentSection.content.trim();
        }
        sections.push(currentSection);
    }

    // Merge sections with the same number
    const mergedSections = new Map<number, Section>();

    for (const section of sections) {
        if (mergedSections.has(section.number)) {
            // Merge with existing section
            const existing = mergedSections.get(section.number)!;
            // Combine titles if different (use first title as primary)
            if (existing.title !== section.title && !existing.title.includes(section.title)) {
                existing.title = `${existing.title} / ${section.title}`;
            }
            // Merge content with separator
            const existingContent = existing.content || '';
            const newContent = section.content || '';
            if (newContent.trim()) {
                existing.content = existingContent
                    ? `${existingContent}\n\n---\n\n${newContent}`
                    : newContent;
            }
        } else {
            // First occurrence of this section number
            mergedSections.set(section.number, { ...section });
        }
    }

    // Convert map to array and sort by number
    const result = Array.from(mergedSections.values());
    result.sort((a, b) => a.number - b.number);

    return result;
}

// Watch for content changes and parse sections - always try to parse
watch(() => props.content, (content) => {
    if (content && content.trim().length > 0) {
        const parsed = parseSections(content);
        sections.value = parsed;
        console.log('SectionAdjuster: Parsed sections:', parsed.length, parsed);
    } else {
        sections.value = [];
    }
}, { immediate: true });

function selectSection(sectionNumber: number) {
    selectedSectionNumber.value = sectionNumber;
}

function openSectionAdjustDialog() {
    if (selectedSectionNumber.value === null) return;
    sectionAdjustRequest.value = '';
    showSectionDialog.value = true;
}

async function handleSectionAdjust() {
    if (!sectionAdjustRequest.value.trim()) {
        ElMessage.warning('请输入调整要求');
        return;
    }

    if (selectedSectionNumber.value === null) {
        return;
    }

    // Determine API endpoint based on document type
    let adjustFunction: ((projectId: string, docId: string, sectionNumber: number, userRequest: string) => Promise<any>) | null = null;

    if (props.documentType === 'PRD') {
        adjustFunction = apiClient.adjustPRDSection;
    } else if (props.documentType === 'REQUIREMENT') {
        // We'll need to add this API method
        adjustFunction = apiClient.adjustRequirementSection;
    }

    if (!adjustFunction) {
        ElMessage.warning('当前文档类型暂不支持章节调整功能');
        return;
    }

    if (!props.projectId) {
        ElMessage.warning('章节调整功能需要项目ID。如果这是交互式会话，请等待项目创建完成后再试。');
        console.warn('SectionAdjuster: projectId is missing', {
            documentType: props.documentType,
            action: props.action,
        });
        return;
    }

    // Get document ID if not provided
    let docId = props.documentId;
    if (!docId && props.projectId) {
        try {
            if (props.documentType === 'PRD') {
                const prdsResponse: any = await apiClient.getPRDs(props.projectId, false);
                if (prdsResponse.prds && prdsResponse.prds.length > 0) {
                    docId = prdsResponse.prds[0].id;
                }
            } else if (props.documentType === 'REQUIREMENT') {
                // Similar logic for requirement specs
                const docsResponse: any = await apiClient.getProjectDocuments(props.projectId);
                const requirementDocs = docsResponse.documents?.filter((doc: any) => doc.docType === 'requirement') || [];
                if (requirementDocs.length > 0) {
                    docId = requirementDocs[0].id;
                }
            }

            if (!docId) {
                // If no document found in database, try workspace-only API
                console.log('No document found in database, trying workspace-only adjustment');
                // Fall through to workspace-only API call
            }
        } catch (error: any) {
            console.warn('Failed to get document from database, trying workspace-only:', error);
            // Fall through to workspace-only API call
        }
    }

    sectionAdjustLoading.value = true;
    try {
        let result: any;

        // If we have docId, use the standard API
        if (docId) {
            result = await adjustFunction(
                props.projectId,
                docId,
                selectedSectionNumber.value,
                sectionAdjustRequest.value
            );
        } else {
            // Use workspace-only API (for interactive sessions)
            const apiUrl = (import.meta as any).env?.VITE_API_URL;
            if (!apiUrl) {
                throw new Error('VITE_API_URL environment variable is not set. Please configure it in your .env file.');
            }
            const response = await fetch(
                `${apiUrl}/projects/${props.projectId}/sections/${selectedSectionNumber.value}/adjust`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userRequest: sectionAdjustRequest.value,
                        documentType: props.documentType,
                        // Try to get applicationId and version from current content or use defaults
                        applicationId: 'default',
                        version: 1,
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '调整失败');
            }

            result = await response.json();
        }

        ElMessage.success('章节调整成功');

        // Update the section content in local state
        const sectionIndex = sections.value.findIndex(s => s.number === selectedSectionNumber.value);
        if (sectionIndex !== -1 && result.section) {
            const adjustedContent = result.section.content.replace(/^##\s+\d+\.\s+.+\n\n?/, '');
            sections.value[sectionIndex].content = adjustedContent;

            // Notify parent component
            if (props.onSectionAdjusted) {
                props.onSectionAdjusted(selectedSectionNumber.value, result.section.content);
            }
        }

        showSectionDialog.value = false;
        sectionAdjustRequest.value = '';
    } catch (error: any) {
        ElMessage.error('调整失败: ' + (error.message || '未知错误'));
    } finally {
        sectionAdjustLoading.value = false;
    }
}
</script>

<style scoped>
.section-adjuster {
    margin-top: 20px;
    padding-top: 16px;
}

.sections-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}

.section-tag {
    transition: all 0.2s;
}

.section-tag:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sections-empty {
    margin-top: 12px;
}

.section-adjust-dialog {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.section-original h4,
.section-adjust h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #303133;
}

.section-content {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 13px;
    line-height: 1.6;
    color: #606266;
    background: #f5f7fa;
    padding: 12px;
    border-radius: 4px;
}
</style>
