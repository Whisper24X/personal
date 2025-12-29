<template>
    <div class="interactive-confirmation">
        <el-card class="confirmation-card" shadow="always">
            <template #header>
                <div class="card-header">
                    <div class="header-left">
                        <el-icon :size="24" color="#409EFF">
                            <component :is="getRoleIcon(roleInfo.role)" />
                        </el-icon>
                        <div class="role-info">
                            <h3 class="role-name">{{ roleInfo.role }}</h3>
                            <el-tag :type="getActionType(roleInfo.action)" size="small">
                                {{ roleInfo.action === 'idle' ? '空闲状态' : roleInfo.action }}
                            </el-tag>
                        </div>
                    </div>
                    <el-tag :type="isIdle ? 'info' : 'warning'" effect="dark" size="large">
                        <el-icon>
                            <Clock />
                        </el-icon>
                        {{ isIdle ? '状态检查' : '等待确认' }}
                    </el-tag>
                </div>
            </template>

            <div class="content-section">
                <div class="section-header">
                    <h4>
                        <el-icon>
                            <Document />
                        </el-icon>
                        {{ isIdle ? '角色状态' : '生成内容' }}
                    </h4>
                    <el-button-group size="small">
                        <el-button :type="viewMode === 'preview' ? 'primary' : ''" @click="viewMode = 'preview'">
                            预览
                        </el-button>
                        <el-button :type="viewMode === 'full' ? 'primary' : ''" @click="viewMode = 'full'">
                            完整内容
                        </el-button>
                    </el-button-group>
                </div>

                <div v-if="roleInfo.outputFiles && roleInfo.outputFiles.length > 0" class="output-files">
                    <el-divider content-position="left">
                        <el-icon>
                            <FolderOpened />
                        </el-icon>
                        生成的文件 ({{ roleInfo.outputFiles.length }})
                    </el-divider>
                    <div class="files-tabs">
                        <el-tag v-for="(file, index) in roleInfo.outputFiles" :key="getFilePath(file)" class="file-tag"
                            :type="selectedFileIndex === index ? 'primary' : 'info'"
                            :effect="selectedFileIndex === index ? 'dark' : 'plain'" @click="selectFile(index)"
                            style="cursor: pointer;">
                            <el-icon>
                                <DocumentCopy />
                            </el-icon>
                            {{ getFilePath(file) }}
                        </el-tag>
                    </div>
                </div>

                <el-scrollbar :max-height="viewMode === 'preview' ? '200px' : '400px'" class="content-scrollbar">
                    <div class="content-display">
                        <!-- File content view/edit -->
                        <!-- For WritePRD and WriteRequirementSpec actions, always show main content first, not files -->
                        <div v-if="selectedFileIndex >= 0 && hasFiles && roleInfo.action !== 'WritePRD' && roleInfo.action !== 'WriteRequirementSpec'"
                            class="file-content-editor">
                            <div class="file-header">
                                <span class="file-path">{{ getFilePath(roleInfo.outputFiles![selectedFileIndex])
                                    }}</span>
                                <el-button v-if="!isEditing" size="small" type="primary" :icon="Edit"
                                    @click="startEditFile(selectedFileIndex)">
                                    编辑文件
                                </el-button>
                            </div>
                            <el-input v-if="isEditing && selectedFileIndex >= 0"
                                :model-value="getCurrentFileEditedContent()"
                                @update:model-value="updateCurrentFileContent" type="textarea"
                                :rows="viewMode === 'preview' ? '10' : '20'" placeholder="编辑文件内容..." />
                            <pre v-else class="content-text file-content">{{ getFileContent(selectedFileIndex) }}</pre>
                        </div>
                        <!-- Main content view/edit -->
                        <div v-else>
                            <el-input v-if="isEditing && !isIdle" v-model="editedContent" type="textarea"
                                :rows="viewMode === 'preview' ? '10' : '20'" placeholder="编辑内容..." />
                            <div v-else-if="isIdle" class="idle-content">
                                <el-alert type="info" :closable="false" show-icon>
                                    <template #title>
                                        <div class="idle-message">{{ displayContent }}</div>
                                    </template>
                                </el-alert>
                            </div>
                            <pre v-else class="content-text">{{ displayContent }}</pre>
                        </div>
                    </div>
                </el-scrollbar>

                <div v-if="viewMode === 'preview' && roleInfo.content.length > 500" class="preview-notice">
                    <el-alert title="这是内容预览，点击'完整内容'查看全部" type="info" :closable="false" show-icon />
                </div>

                <!-- Section adjustment using generic component -->
                <SectionAdjuster v-if="hasSectionedContent" :content="roleInfo.content" :document-type="documentType"
                    :action="roleInfo.action" :project-id="projectId || ''" :document-id="prdId || ''"
                    @section-adjusted="handleSectionAdjusted" />
            </div>

            <el-divider />

            <div class="actions-section">
                <h4 class="actions-title">
                    <el-icon>
                        <Operation />
                    </el-icon>
                    请选择操作
                </h4>

                <div class="action-buttons">
                    <el-button v-if="!isEditing" type="success" size="large" :icon="Check"
                        @click="handleAction('continue')" :loading="loading">
                        <div class="button-content">
                            <span class="shortcut">C</span>
                            <span>{{ isIdle ? '继续下一步' : '确认继续' }}</span>
                        </div>
                    </el-button>

                    <el-button v-if="!isIdle && !isEditing && (!hasFiles || selectedFileIndex < 0)" type="primary"
                        size="large" :icon="Edit" @click="startEdit">
                        <div class="button-content">
                            <span class="shortcut">E</span>
                            <span>编辑内容</span>
                        </div>
                    </el-button>

                    <el-button v-if="!isIdle && isEditing" type="success" size="large" :icon="Check" @click="saveEdit"
                        :loading="loading">
                        保存修改并继续
                    </el-button>

                    <el-button v-if="!isIdle && isEditing" size="large" :icon="Close" @click="cancelEdit">
                        取消编辑
                    </el-button>

                    <el-button v-if="!isIdle && !isEditing" type="warning" size="large" :icon="Refresh"
                        @click="handleAction('regenerate')" :loading="loading">
                        <div class="button-content">
                            <span class="shortcut">R</span>
                            <span>重新生成</span>
                        </div>
                    </el-button>

                    <el-button v-if="!isEditing" type="info" size="large" plain :icon="DArrowRight"
                        @click="handleAction('skip')" :loading="loading">
                        <div class="button-content">
                            <span class="shortcut">S</span>
                            <span>跳过</span>
                        </div>
                    </el-button>

                    <el-button v-if="!isEditing" type="danger" size="large" plain :icon="CloseBold" @click="confirmQuit"
                        :loading="loading">
                        <div class="button-content">
                            <span class="shortcut">Q</span>
                            <span>退出</span>
                        </div>
                    </el-button>
                </div>

                <el-alert class="shortcuts-hint" type="info" :closable="false">
                    <template #title>
                        <el-icon>
                            <InfoFilled />
                        </el-icon>
                        快捷键提示: 按 C/E/R/S/Q 快速执行对应操作
                    </template>
                </el-alert>
            </div>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import {
    Check,
    Edit,
    Refresh,
    DArrowRight,
    CloseBold,
    Close,
    Clock,
    Document,
    DocumentCopy,
    FolderOpened,
    Operation,
    InfoFilled,
    UserFilled,
    SetUp,
    Cpu,
} from '@element-plus/icons-vue';
import SectionAdjuster from './SectionAdjuster.vue';

interface FileInfo {
    path: string;
    content: string;
}

interface RoleInfo {
    role: string;
    action: string;
    content: string;
    outputFiles?: Array<FileInfo | string>;
}

interface Props {
    roleInfo: RoleInfo;
    loading?: boolean;
    projectId?: string;
    prdId?: string;
}

const props = withDefaults(defineProps<Props>(), {
    loading: false,
    projectId: '',
    prdId: '',
});

const emit = defineEmits<{
    (e: 'action', action: string, modifiedContent?: string): void;
}>();

const viewMode = ref<'preview' | 'full'>('preview');
const isEditing = ref(false);
const editedContent = ref('');
const editedFiles = ref<Map<string, string>>(new Map());
const selectedFileIndex = ref<number>(-1);

// Document type detection
const documentType = computed(() => {
    if (props.roleInfo.action === 'WritePRD') {
        return 'PRD';
    } else if (props.roleInfo.action === 'WriteRequirementSpec') {
        return 'REQUIREMENT';
    } else if (props.roleInfo.action === 'WriteDesign') {
        return 'DESIGN';
    }
    return 'OTHER';
});

// Check if content has sections - more lenient check
const hasSectionedContent = computed(() => {
    const content = props.roleInfo.content;
    if (!content || content.trim().length === 0) return false;

    // Check for section markers - check if any line starts with ## followed by a number
    const lines = content.split('\n');
    const hasSectionMarkers = lines.some(line => /^##\s+\d+\.\s+/.test(line.trim()));

    // Also check for document type indicators
    const isDocumentType = props.roleInfo.action === 'WritePRD' ||
        props.roleInfo.action === 'WriteRequirementSpec' ||
        props.roleInfo.action === 'WriteDesign';

    return hasSectionMarkers || (isDocumentType && content.length > 100);
});

function handleSectionAdjusted(sectionNumber: number) {
    // Optionally update the displayed content
    ElMessage.success(`章节 ${sectionNumber} 已调整`);
}

const displayContent = computed(() => {
    if (viewMode.value === 'preview') {
        return props.roleInfo.content.length > 500
            ? props.roleInfo.content.substring(0, 500) + '\n...\n\n[查看完整内容]'
            : props.roleInfo.content;
    }
    return props.roleInfo.content;
});

const hasFiles = computed(() => {
    return props.roleInfo.outputFiles && props.roleInfo.outputFiles.length > 0;
});

// Auto-select first file when files are available
// But for WritePRD and WriteRequirementSpec actions, don't auto-select files - show main content instead
watch(() => props.roleInfo.outputFiles, (files) => {
    if (files && files.length > 0 && selectedFileIndex.value < 0 &&
        props.roleInfo.action !== 'WritePRD' && props.roleInfo.action !== 'WriteRequirementSpec') {
        selectedFileIndex.value = 0;
    }
}, { immediate: true });

// Reset file selection when action is WritePRD or WriteRequirementSpec to ensure main content is shown
watch(() => props.roleInfo.action, (action) => {
    if ((action === 'WritePRD' || action === 'WriteRequirementSpec') && selectedFileIndex.value >= 0) {
        selectedFileIndex.value = -1;
    }
}, { immediate: true });

function getFilePath(file: FileInfo | string): string {
    return typeof file === 'string' ? file : file.path;
}

function getFileContent(index: number): string {
    if (index < 0 || !props.roleInfo.outputFiles || index >= props.roleInfo.outputFiles.length) {
        return '';
    }
    const file = props.roleInfo.outputFiles[index];
    if (typeof file === 'string') {
        return '';
    }
    // Check if file is being edited
    const edited = editedFiles.value.get(file.path);
    return edited !== undefined ? edited : file.content;
}

function getCurrentFileEditedContent(): string {
    if (selectedFileIndex.value < 0 || !props.roleInfo.outputFiles) {
        return '';
    }
    const file = props.roleInfo.outputFiles[selectedFileIndex.value];
    if (typeof file === 'string') {
        return '';
    }
    return editedFiles.value.get(file.path) || file.content;
}

function updateCurrentFileContent(value: string) {
    if (selectedFileIndex.value < 0 || !props.roleInfo.outputFiles) {
        return;
    }
    const file = props.roleInfo.outputFiles[selectedFileIndex.value];
    if (typeof file !== 'string') {
        editedFiles.value.set(file.path, value);
    }
}

function selectFile(index: number) {
    selectedFileIndex.value = index;
    // Initialize edited content if editing
    if (isEditing.value && props.roleInfo.outputFiles) {
        const file = props.roleInfo.outputFiles[index];
        if (typeof file !== 'string') {
            const path = file.path;
            if (!editedFiles.value.has(path)) {
                editedFiles.value.set(path, file.content);
            }
        }
    }
}

function startEditFile(index: number) {
    if (!props.roleInfo.outputFiles || index < 0 || index >= props.roleInfo.outputFiles.length) {
        return;
    }
    const file = props.roleInfo.outputFiles[index];
    if (typeof file !== 'string') {
        editedFiles.value.set(file.path, file.content);
        isEditing.value = true;
        viewMode.value = 'full';
    }
}

function getRoleIcon(role: string) {
    const iconMap: Record<string, any> = {
        Salesperson: UserFilled,
        ProductManager: UserFilled,
        Architect: SetUp,
        Engineer: Cpu,
        QAEngineer: Check,
    };
    return iconMap[role] || UserFilled;
}

function getActionType(action: string): 'success' | 'warning' | 'info' | 'danger' {
    const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
        WriteRequirementSpec: 'info',
        WritePRD: 'success',
        WriteDesign: 'warning',
        WriteCode: 'info',
        WriteTest: 'danger',
        idle: 'info',
    };
    return typeMap[action] || 'info';
}

const isIdle = computed(() => props.roleInfo.action === 'idle');


function startEdit() {
    isEditing.value = true;
    editedContent.value = props.roleInfo.content;
    viewMode.value = 'full';
    // Initialize file edits
    if (props.roleInfo.outputFiles) {
        props.roleInfo.outputFiles.forEach(file => {
            if (typeof file !== 'string') {
                editedFiles.value.set(file.path, file.content);
            }
        });
    }
}

function cancelEdit() {
    isEditing.value = false;
    editedContent.value = '';
    editedFiles.value.clear();
    selectedFileIndex.value = -1;
}

function saveEdit() {
    // Check if editing files
    if (selectedFileIndex.value >= 0 && hasFiles.value && props.roleInfo.outputFiles) {
        const file = props.roleInfo.outputFiles[selectedFileIndex.value];
        if (typeof file !== 'string') {
            const editedContent = editedFiles.value.get(file.path);
            if (editedContent === undefined || editedContent.trim() === '') {
                ElMessage.warning('文件内容不能为空');
                return;
            }
        }
    } else {
        // Editing main content
        if (editedContent.value.trim() === '') {
            ElMessage.warning('内容不能为空');
            return;
        }
    }

    isEditing.value = false;

    // Prepare modified content with files
    let modifiedContent = editedContent.value || props.roleInfo.content;

    // If files were edited, include them in the content
    if (editedFiles.value.size > 0 && props.roleInfo.outputFiles) {
        const filesSummary = Array.from(editedFiles.value.entries())
            .map(([path, content]) => `\n\n===== FILE: ${path} =====\n${content}\n===== END FILE =====`)
            .join('');
        modifiedContent += filesSummary;
    }

    emit('action', 'edit', modifiedContent);
}

function handleAction(action: string) {
    emit('action', action);
}

async function confirmQuit() {
    try {
        await ElMessageBox.confirm(
            '确定要退出吗？当前进度会被保存，您可以稍后继续。',
            '确认退出',
            {
                confirmButtonText: '确定退出',
                cancelButtonText: '取消',
                type: 'warning',
            }
        );
        emit('action', 'quit');
    } catch {
        // User cancelled
    }
}

// Keyboard shortcuts
function handleKeyPress(event: KeyboardEvent) {
    if (isEditing.value) return;

    const key = event.key.toLowerCase();
    switch (key) {
        case 'c':
            handleAction('continue');
            break;
        case 'e':
            startEdit();
            break;
        case 'r':
            handleAction('regenerate');
            break;
        case 's':
            handleAction('skip');
            break;
        case 'q':
            confirmQuit();
            break;
    }
}

onMounted(() => {
    document.addEventListener('keypress', handleKeyPress);
});

onUnmounted(() => {
    document.removeEventListener('keypress', handleKeyPress);
});
</script>

<style scoped>
.interactive-confirmation {
    width: 100%;
}

.confirmation-card {
    border: 2px solid #409EFF;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.role-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.role-name {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #303133;
}

.content-section {
    margin-bottom: 20px;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.section-header h4 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    color: #303133;
}

.output-files {
    margin-bottom: 16px;
}

.files-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}

.file-tag {
    margin-right: 8px;
    margin-bottom: 8px;
    transition: all 0.2s;
}

.file-tag:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.file-content-editor {
    width: 100%;
}

.file-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e4e7ed;
}

.file-path {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
    color: #409EFF;
    font-weight: 600;
}

.file-content {
    max-height: 600px;
    overflow-y: auto;
}

.content-scrollbar {
    background: #f5f7fa;
    border-radius: 4px;
    padding: 16px;
}

.content-display {
    width: 100%;
}

.content-text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
    line-height: 1.6;
    color: #303133;
}

.preview-notice {
    margin-top: 12px;
}

.idle-content {
    padding: 16px;
}

.idle-message {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.8;
    color: #606266;
}

.actions-section {
    margin-top: 20px;
}

.actions-title {
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    color: #303133;
}

.action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
}

.action-buttons .el-button {
    flex: 1;
    min-width: 140px;
}

.button-content {
    display: flex;
    align-items: center;
    gap: 8px;
}

.shortcut {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    font-weight: bold;
    font-size: 12px;
}

.shortcuts-hint {
    margin-top: 16px;
}

.sections-section {
    margin-top: 20px;
    padding-top: 16px;
}

.sections-empty {
    margin-top: 12px;
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

@media (max-width: 768px) {
    .action-buttons .el-button {
        flex: 1 1 100%;
        min-width: auto;
    }

    .card-header {
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
    }
}
</style>
