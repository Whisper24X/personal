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
                <!-- Conversation History -->
                <div v-if="conversationHistory && conversationHistory.messages.length > 0" class="conversation-history">
                    <h4>对话历史（{{ conversationHistory.messages.length }} 条）：</h4>
                    <el-scrollbar max-height="200px" ref="conversationScrollbar">
                        <div class="conversation-messages" ref="conversationMessages">
                            <div v-for="(msg, index) in conversationHistory.messages" :key="index"
                                :class="['conversation-message', msg.role === 'user' ? 'user-message' : 'assistant-message']">
                                <div class="message-role">{{ msg.role === 'user' ? '👤 您' : '🤖 AI助手' }}</div>
                                <div class="message-content" v-if="msg.role === 'user'">{{ msg.content }}</div>
                                <div class="message-content" v-else>
                                    <pre class="section-content-preview">{{ msg.content.substring(0, 200) }}{{ msg.content.length > 200 ? '...' : '' }}</pre>
                                </div>
                                <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
                            </div>
                        </div>
                    </el-scrollbar>
                </div>
                
                <div class="section-original">
                    <h4>当前章节内容：</h4>
                    <el-scrollbar max-height="200px">
                        <pre class="section-content">{{ selectedSectionContent }}</pre>
                    </el-scrollbar>
                </div>
                <div class="section-adjust">
                    <h4>调整要求：</h4>
                    <el-input v-model="sectionAdjustRequest" type="textarea" :rows="6"
                        placeholder="请描述您希望如何调整这个章节的内容，例如：&#10;- 添加更多细节&#10;- 修改某个功能描述&#10;- 补充验收标准等&#10;&#10;您可以基于之前的对话继续调整..." />
                </div>
            </div>
            <template #footer>
                <el-button @click="closeDialog">完成</el-button>
                <el-button type="primary" @click="handleSectionAdjust" :loading="sectionAdjustLoading" :disabled="!sectionAdjustRequest.trim()">
                    {{ conversationHistory && conversationHistory.messages.length > 0 ? '继续调整' : '确认调整' }}
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
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
    documentType?: 'PRD' | 'MRD' | 'DESIGN' | 'OTHER';
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

interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

interface ConversationHistory {
    sectionNumber: number;
    messages: ConversationMessage[];
    lastUpdated: string;
}

const sections = ref<Section[]>([]);
const selectedSectionNumber = ref<number | null>(null);
const showSectionDialog = ref(false);
const sectionAdjustRequest = ref('');
const sectionAdjustLoading = ref(false);
const conversationHistory = ref<ConversationHistory | null>(null);
const loadingHistory = ref(false);
const conversationScrollbar = ref<any>(null);
const conversationMessages = ref<HTMLElement | null>(null);

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

async function openSectionAdjustDialog() {
    if (selectedSectionNumber.value === null) return;
    sectionAdjustRequest.value = '';
    showSectionDialog.value = true;
    
    // Load conversation history
    await loadConversationHistory();
}

async function loadConversationHistory() {
    if (!selectedSectionNumber.value || !props.projectId) return;
    
    loadingHistory.value = true;
    try {
        const apiUrl = (import.meta as any).env?.VITE_API_URL;
        if (!apiUrl) {
            return;
        }
        
        const response = await fetch(
            `${apiUrl}/projects/${props.projectId}/sections/${selectedSectionNumber.value}/conversation?documentType=${props.documentType}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            conversationHistory.value = data.conversationHistory || null;
        }
    } catch (error: any) {
        console.warn('Failed to load conversation history:', error);
        conversationHistory.value = null;
    } finally {
        loadingHistory.value = false;
    }
}

function formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
}

function closeDialog() {
    // Clear input when closing
    sectionAdjustRequest.value = '';
    showSectionDialog.value = false;
}

function scrollConversationToBottom() {
    // Scroll conversation history to bottom
    nextTick(() => {
        if (conversationMessages.value) {
            conversationMessages.value.scrollTop = conversationMessages.value.scrollHeight;
        }
        if (conversationScrollbar.value) {
            const scrollbarEl = conversationScrollbar.value.$el?.querySelector('.el-scrollbar__wrap');
            if (scrollbarEl) {
                scrollbarEl.scrollTop = scrollbarEl.scrollHeight;
            }
        }
    });
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
    } else if (props.documentType === 'MRD') {
        adjustFunction = async (projectId: string, docId: string, sectionNumber: number, userRequest: string) => {
            return apiClient.adjustMRDSection(projectId, docId, sectionNumber, userRequest);
        };
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
            } else if (props.documentType === 'MRD') {
                const mrdsResponse: any = await apiClient.getMRDs(props.projectId);
                if (mrdsResponse.documents && mrdsResponse.documents.length > 0) {
                    docId = mrdsResponse.documents[0].id;
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
                        // Don't pass applicationId if not available - backend will handle it
                        // version defaults to 1 if not provided
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

        // Update conversation history
        if (result.conversationHistory) {
            conversationHistory.value = result.conversationHistory;
        }

        // Update the section content in local state
        const sectionIndex = sections.value.findIndex(s => s.number === selectedSectionNumber.value);
        if (sectionIndex !== -1 && result.section) {
            // Update section content
            sections.value[sectionIndex].content = result.section.content;
            
            // Trigger content update callback if provided
            if (props.onSectionAdjusted) {
                props.onSectionAdjusted(selectedSectionNumber.value, result.section.content);
            }
        }

        // Clear input but keep dialog open for continuous conversation
        sectionAdjustRequest.value = '';
        
        // Reload conversation history to get latest updates
        await loadConversationHistory();
        
        // Scroll to bottom of conversation history
        await nextTick();
        scrollConversationToBottom();
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
    gap: 16px;
}

.conversation-history {
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    padding: 12px;
    background-color: #f5f7fa;
}

.conversation-history h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #606266;
}

.conversation-messages {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.conversation-message {
    padding: 10px;
    border-radius: 4px;
    background-color: white;
    border-left: 3px solid #409eff;
}

.conversation-message.user-message {
    border-left-color: #67c23a;
}

.conversation-message.assistant-message {
    border-left-color: #409eff;
}

.message-role {
    font-weight: bold;
    font-size: 12px;
    color: #909399;
    margin-bottom: 4px;
}

.message-content {
    font-size: 13px;
    color: #303133;
    white-space: pre-wrap;
    word-break: break-word;
    margin-bottom: 4px;
}

.message-time {
    font-size: 11px;
    color: #c0c4cc;
    text-align: right;
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

.section-content-preview {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #606266;
    background: transparent;
    padding: 0;
}

.conversation-messages {
    max-height: 200px;
    overflow-y: auto;
}
</style>
