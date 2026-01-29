<template>
    <div class="interactive-confirmation">
        <!-- Use dynamic component for conditional card wrapper -->
        <component :is="hideCard ? 'div' : 'el-card'" 
            :class="{ 'confirmation-card': !hideCard }" 
            :shadow="hideCard ? undefined : 'always'">
            
            <!-- Header section (only as slot when using el-card) -->
            <template v-if="!hideCard" #header>
                <ConfirmationHeader 
                    :role-info="roleInfo" 
                    :is-idle="isIdle"
                    :get-role-icon="getRoleIcon"
                    :get-action-type="getActionType"
                    :get-role-description="getRoleDescription"
                    :get-action-description="getActionDescription"
                />
            </template>
            
            <!-- Header section when not using card -->
            <ConfirmationHeader 
                v-if="hideCard"
                :role-info="roleInfo" 
                :is-idle="isIdle"
                :get-role-icon="getRoleIcon"
                :get-action-type="getActionType"
                :get-role-description="getRoleDescription"
                :get-action-description="getActionDescription"
            />

            <!-- Error Alert for Max Retries -->
            <el-alert
                v-if="roleInfo.retryCount !== undefined && roleInfo.retryCount >= 3"
                type="error"
                :closable="false"
                show-icon
                title="Action执行失败"
                style="margin-bottom: 16px;">
                <template #default>
                    <div class="error-message">
                        <p><strong>该action已重试3次仍失败，需要人工介入。</strong></p>
                        <p>Action: {{ roleInfo.action }}</p>
                        <p>重试次数: {{ roleInfo.retryCount }}/3</p>
                        <p>请检查错误原因或选择跳过该步骤。</p>
                    </div>
                </template>
            </el-alert>

            <!-- Content Section -->
            <div class="content-section">
                <div class="section-header">
                    <h4>
                        <el-icon><Document /></el-icon>
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

                <!-- Zip Archive Download -->
                <div v-if="zipPath" class="zip-download-section">
                    <el-alert type="success" :closable="false" show-icon>
                        <template #title>
                            <div class="zip-info">
                                <el-icon><Download /></el-icon>
                                <span>{{ zipType === 'workspace_zip' ? 'Workspace压缩包已生成' : '代码压缩包已生成' }}</span>
                                <el-button type="primary" size="small" :icon="Download" @click="downloadZip">
                                    下载压缩包
                                </el-button>
                            </div>
                        </template>
                    </el-alert>
                </div>

                <!-- Output Files -->
                <div v-if="roleInfo.outputFiles && roleInfo.outputFiles.length > 0" class="output-files">
                    <el-divider content-position="left">
                        <el-icon><FolderOpened /></el-icon>
                        生成的文件 ({{ roleInfo.outputFiles.length }})
                    </el-divider>
                    <div class="files-tabs">
                        <el-tag v-for="(file, index) in roleInfo.outputFiles" :key="getFilePath(file)" class="file-tag"
                            :type="selectedFileIndex === index ? 'primary' : 'info'"
                            :effect="selectedFileIndex === index ? 'dark' : 'plain'" @click="selectFile(index)"
                            style="cursor: pointer;">
                            <el-icon><DocumentCopy /></el-icon>
                            {{ getFilePath(file) }}
                        </el-tag>
                    </div>
                </div>

                <!-- GeneratePrototype: 左右分栏布局 -->
                <div v-if="isPrototypeAction" class="prototype-layout">
                    <el-row :gutter="20">
                        <!-- 左侧：PRD内容 -->
                        <el-col :span="12">
                            <div class="prd-content-section">
                                <div class="section-header">
                                    <h4>
                                        <el-icon><Document /></el-icon>
                                        PRD内容
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
                                <el-scrollbar class="prd-scrollbar">
                                    <div v-if="prdLoading" class="loading-container">
                                        <el-skeleton :rows="5" animated />
                                    </div>
                                    <div v-else-if="!prdContent" class="empty-container">
                                        <el-empty description="PRD内容未找到" />
                                    </div>
                                    <div v-else class="prd-content-display">
                                        <el-input v-if="isEditing" v-model="editedContent" type="textarea"
                                            :rows="viewMode === 'preview' ? 15 : 25" placeholder="编辑PRD内容..." />
                                        <pre v-else class="content-text">{{ displayPRDContent }}</pre>
                                    </div>
                                </el-scrollbar>
                                <div v-if="viewMode === 'preview' && prdContent && prdContent.length > 1000"
                                    class="preview-notice">
                                    <el-alert title="这是内容预览，点击'完整内容'查看全部" type="info" :closable="false" show-icon />
                                </div>
                            </div>
                        </el-col>
                        
                        <!-- 右侧：原型预览 -->
                        <el-col :span="12">
                            <VersionPrototypePreview
                                v-if="projectId && prototypePreviewUrl"
                                :preview-url="prototypePreviewUrl"
                                :auto-load="true"
                            />
                            <div v-else-if="projectId" class="empty-prototype">
                                <el-empty description="正在加载原型预览..." />
                            </div>
                        </el-col>
                    </el-row>
                </div>

                <!-- 非GeneratePrototype: 原有内容显示 -->
                <template v-else>
                    <el-scrollbar :max-height="viewMode === 'preview' ? '200px' : undefined" class="content-scrollbar">
                        <div class="content-display">
                            <!-- File content view/edit -->
                            <div v-if="selectedFileIndex >= 0 && hasFiles && roleInfo.action !== 'WritePRD'"
                                class="file-content-editor">
                                <div class="file-header">
                                    <span class="file-path">{{ getFilePath(roleInfo.outputFiles![selectedFileIndex]) }}</span>
                                    <el-button v-if="!isEditing" size="small" type="primary" :icon="Edit"
                                        @click="startEditFile(selectedFileIndex)">
                                        编辑文件
                                    </el-button>
                                </div>
                                <el-input v-if="isEditing && selectedFileIndex >= 0"
                                    :model-value="getCurrentFileEditedContent()"
                                    @update:model-value="updateCurrentFileContent" type="textarea"
                                    :rows="viewMode === 'preview' ? 10 : 20" placeholder="编辑文件内容..." />
                                <pre v-else class="content-text file-content">{{ getFileContent(selectedFileIndex) }}</pre>
                            </div>
                            <!-- Main content view/edit -->
                            <div v-else>
                                <el-input v-if="isEditing && !isIdle" v-model="editedContent" type="textarea"
                                    :rows="viewMode === 'preview' ? 10 : 20" placeholder="编辑内容..." />
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

                    <div v-if="viewMode === 'preview' && roleInfo.content && roleInfo.content.length > 500"
                        class="preview-notice">
                        <el-alert title="这是内容预览，点击'完整内容'查看全部" type="info" :closable="false" show-icon />
                    </div>

                    <!-- Section adjustment -->
                    <SectionAdjuster v-if="hasSectionedContent" :content="roleInfo.content" :document-type="documentType"
                        :action="roleInfo.action" :project-id="projectId || ''" :document-id="prdId || ''"
                        @section-adjusted="handleSectionAdjusted" />
                </template>
            </div>

            <el-divider />

            <!-- Actions Section -->
            <div class="actions-section">
                <h4 class="actions-title">
                    <el-icon><Operation /></el-icon>
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
                        <el-icon><InfoFilled /></el-icon>
                        快捷键提示: 按 C/E/R/S/Q 快速执行对应操作
                    </template>
                </el-alert>
            </div>
        </component>
    </div>
</template>

<!-- Extracted Header Component (defined inline) -->
<script lang="ts">
import { defineComponent, h } from 'vue';
import { ElIcon, ElTag } from 'element-plus';
import { Clock, User, Operation } from '@element-plus/icons-vue';

// Inline component for header to avoid duplication
const ConfirmationHeader = defineComponent({
    name: 'ConfirmationHeader',
    props: {
        roleInfo: { type: Object, required: true },
        isIdle: { type: Boolean, required: true },
        getRoleIcon: { type: Function, required: true },
        getActionType: { type: Function, required: true },
        getRoleDescription: { type: Function, required: true },
        getActionDescription: { type: Function, required: true },
    },
    setup(props) {
        return () => h('div', { class: 'card-header' }, [
            h('div', { class: 'header-left' }, [
                h(ElIcon, { size: 24, color: '#409EFF' }, () => h(props.getRoleIcon(props.roleInfo.role))),
                h('div', { class: 'role-info' }, [
                    h('h3', { class: 'role-name' }, props.roleInfo.role),
                    h(ElTag, { type: props.getActionType(props.roleInfo.action), size: 'small' }, 
                        () => props.roleInfo.action === 'idle' ? '空闲状态' : props.roleInfo.action),
                    // Role and Action Description
                    (props.getRoleDescription(props.roleInfo.role) || props.getActionDescription(props.roleInfo.action)) && !props.isIdle
                        ? h('div', { class: 'role-action-description' }, [
                            props.getRoleDescription(props.roleInfo.role) 
                                ? h('div', { class: 'description-item' }, [
                                    h(ElIcon, null, () => h(User)),
                                    h('span', { class: 'description-text' }, props.getRoleDescription(props.roleInfo.role))
                                ]) : null,
                            props.getActionDescription(props.roleInfo.action)
                                ? h('div', { class: 'description-item' }, [
                                    h(ElIcon, null, () => h(Operation)),
                                    h('span', { class: 'description-text' }, props.getActionDescription(props.roleInfo.action))
                                ]) : null,
                        ]) : null,
                ]),
            ]),
            h(ElTag, { type: props.isIdle ? 'info' : 'warning', effect: 'dark', size: 'large' }, () => [
                h(ElIcon, null, () => h(Clock)),
                props.isIdle ? '状态检查' : '等待确认'
            ]),
        ]);
    },
});

export default { components: { ConfirmationHeader } };
</script>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import {
    Check, Edit, Refresh, DArrowRight, CloseBold, Close,
    Document, DocumentCopy, FolderOpened, InfoFilled,
    UserFilled, SetUp, Cpu, Download,
} from '@element-plus/icons-vue';
import SectionAdjuster from '../../../components/SectionAdjuster.vue';
import PrototypePreview from './PrototypePreview.vue';
import VersionPrototypePreview from './VersionPrototypePreview.vue';
import apiClient from '../../../api/client';
import { useRoleActionStore } from '../../../stores/roleAction';

interface FileInfo {
    path: string;
    content: string;
}

interface RoleInfo {
    role: string;
    action: string;
    content: string;
    outputFiles?: Array<FileInfo | string>;
    instructContent?: {
        zipPath?: string;
        autoCodeEnabled?: boolean;
        type?: string;
    };
    retryCount?: number;
}

interface Props {
    roleInfo: RoleInfo;
    loading?: boolean;
    projectId?: string;
    prdId?: string;
    hideCard?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    loading: false,
    projectId: '',
    prdId: '',
    hideCard: false,
});

const emit = defineEmits<{
    (e: 'action', action: string, modifiedContent?: string): void;
}>();

const viewMode = ref<'preview' | 'full'>('full');
const isEditing = ref(false);
const editedContent = ref('');
const editedFiles = ref<Map<string, string>>(new Map());
const selectedFileIndex = ref<number>(-1);

// PRD content state for GeneratePrototype action
const prdContent = ref<string>('');
const prdLoading = ref(false);
const currentPrdId = ref<string>('');
const prototypePreviewUrl = ref<string>('');

const roleActionStore = useRoleActionStore();

// Computed properties
const zipPath = computed(() => props.roleInfo.instructContent?.zipPath);
const zipType = computed(() => props.roleInfo.instructContent?.type || 'code_zip');
const isIdle = computed(() => props.roleInfo.action === 'idle');
const hasFiles = computed(() => props.roleInfo.outputFiles && props.roleInfo.outputFiles.length > 0);

const documentType = computed(() => {
    const action = props.roleInfo.action;
    if (action === 'WritePRD') return 'PRD';
    if (action === 'WriteMRD') return 'MRD';
    if (action === 'WriteDesign') return 'DESIGN';
    return 'OTHER';
});

const hasSectionedContent = computed(() => {
    const content = props.roleInfo.content;
    if (!content || typeof content !== 'string' || !content.trim()) return false;
    const hasSectionMarkers = content.split('\n').some(line => /^##\s+\d+\.\s+/.test(line.trim()));
    const isDocumentType = ['WritePRD', 'WriteDesign'].includes(props.roleInfo.action);
    return hasSectionMarkers || (isDocumentType && content.length > 100);
});

const isPrototypeAction = computed(() => {
    return props.roleInfo.action === 'GeneratePrototype';
});

const displayContent = computed(() => {
    const content = props.roleInfo.content || '';
    if (viewMode.value === 'preview' && content.length > 500) {
        return content.substring(0, 500) + '\n...\n\n[查看完整内容]';
    }
    return content;
});

const displayPRDContent = computed(() => {
    const content = prdContent.value || '';
    if (viewMode.value === 'preview' && content.length > 1000) {
        return content.substring(0, 1000) + '\n...\n\n[查看完整内容]';
    }
    return content;
});

// Watchers
watch(() => props.roleInfo.outputFiles, (files) => {
    if (files?.length && selectedFileIndex.value < 0 && props.roleInfo.action !== 'WritePRD') {
        selectedFileIndex.value = 0;
    }
}, { immediate: true });

watch(() => props.roleInfo.action, (action) => {
    if (action === 'WritePRD' && selectedFileIndex.value >= 0) {
        selectedFileIndex.value = -1;
    }
}, { immediate: true });

// Watch for GeneratePrototype action and load PRD content
watch(() => [props.prdId, isPrototypeAction, props.roleInfo.content], ([newPrdId, isPrototype, content]) => {
    if (isPrototype) {
        // 优先使用 props.roleInfo.content（即 pendingConfirmation.content）
        if (content && typeof content === 'string' && content.trim().length > 0) {
            prdContent.value = content;
            prdLoading.value = false;
            // 仍然需要加载原型预览URL
            loadPrototypePreviewUrl();
        } else {
            // 如果 content 为空，才通过 API 获取
            loadPRDContent();
        }
    }
}, { immediate: true });

// Helper functions
function getFilePath(file: FileInfo | string): string {
    return typeof file === 'string' ? file : file.path;
}

function getFileContent(index: number): string {
    if (index < 0 || !props.roleInfo.outputFiles || index >= props.roleInfo.outputFiles.length) return '';
    const file = props.roleInfo.outputFiles[index];
    if (typeof file === 'string') return '';
    const edited = editedFiles.value.get(file.path);
    return edited !== undefined ? edited : file.content;
}

function getCurrentFileEditedContent(): string {
    if (selectedFileIndex.value < 0 || !props.roleInfo.outputFiles) return '';
    const file = props.roleInfo.outputFiles[selectedFileIndex.value];
    if (typeof file === 'string') return '';
    return editedFiles.value.get(file.path) || file.content;
}

function updateCurrentFileContent(value: string) {
    if (selectedFileIndex.value < 0 || !props.roleInfo.outputFiles) return;
    const file = props.roleInfo.outputFiles[selectedFileIndex.value];
    if (typeof file !== 'string') {
        editedFiles.value.set(file.path, value);
    }
}

function selectFile(index: number) {
    selectedFileIndex.value = index;
    if (isEditing.value && props.roleInfo.outputFiles) {
        const file = props.roleInfo.outputFiles[index];
        if (typeof file !== 'string' && !editedFiles.value.has(file.path)) {
            editedFiles.value.set(file.path, file.content);
        }
    }
}

function startEditFile(index: number) {
    if (!props.roleInfo.outputFiles || index < 0 || index >= props.roleInfo.outputFiles.length) return;
    const file = props.roleInfo.outputFiles[index];
    if (typeof file !== 'string') {
        editedFiles.value.set(file.path, file.content);
        isEditing.value = true;
        viewMode.value = 'full';
    }
}

function getRoleIcon(role: string) {
    const iconMap: Record<string, any> = {
        Salesperson: UserFilled, ProductManager: UserFilled,
        Architect: SetUp, Engineer: Cpu, QAEngineer: Check,
    };
    return iconMap[role] || UserFilled;
}

function getActionType(action: string): 'success' | 'warning' | 'info' | 'danger' {
    const typeMap: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
        WritePRD: 'success', WriteDesign: 'warning',
        WriteCode: 'info', WriteTest: 'danger', idle: 'info',
    };
    return typeMap[action] || 'info';
}

function getRoleDescription(role: string): string {
    return roleActionStore.getRoleDescription(role);
}

function getActionDescription(action: string): string {
    return roleActionStore.getActionDescription(action);
}

function handleSectionAdjusted(sectionNumber: number) {
    ElMessage.success(`章节 ${sectionNumber} 已调整`);
}

// Action handlers
function startEdit() {
    isEditing.value = true;
    // For GeneratePrototype, edit PRD content; otherwise edit action output
    if (isPrototypeAction.value) {
        editedContent.value = prdContent.value || '';
    } else {
        editedContent.value = props.roleInfo.content || '';
    }
    viewMode.value = 'full';
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
    if (selectedFileIndex.value >= 0 && hasFiles.value && props.roleInfo.outputFiles) {
        const file = props.roleInfo.outputFiles[selectedFileIndex.value];
        if (typeof file !== 'string') {
            const edited = editedFiles.value.get(file.path);
            if (edited === undefined || !edited.trim()) {
                ElMessage.warning('文件内容不能为空');
                return;
            }
        }
    } else if (!editedContent.value.trim()) {
        ElMessage.warning('内容不能为空');
        return;
    }

    isEditing.value = false;
    
    // For GeneratePrototype, save PRD content separately if needed
    // For now, save as action output content
    let modifiedContent = editedContent.value || props.roleInfo.content || '';

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

function handlePrototypeGenerated() {
    ElMessage.success('原型已生成');
}

// Load PRD content for GeneratePrototype action
async function loadPRDContent() {
    // 优先使用 props.roleInfo.content（即 pendingConfirmation.content）
    if (props.roleInfo.content && typeof props.roleInfo.content === 'string' && props.roleInfo.content.trim().length > 0) {
        prdContent.value = props.roleInfo.content;
        prdLoading.value = false;
        // 仍然需要加载原型预览URL
        loadPrototypePreviewUrl();
        return;
    }
    
    if (!props.projectId) return;
    
    prdLoading.value = true;
    
    try {
        // 获取版本列表（现在getPRDs返回的是版本列表）
        const prdsResponse: any = await apiClient.getPRDs(props.projectId, false);
        
        if (prdsResponse.prds && prdsResponse.prds.length > 0) {
            // 获取第一个有prototype的版本的预览URL
            const firstVersionWithPrototype = prdsResponse.prds.find((p: any) => p.hasPrototype && p.previewUrl);
            if (firstVersionWithPrototype) {
                prototypePreviewUrl.value = firstVersionWithPrototype.previewUrl;
            } else {
                prototypePreviewUrl.value = '';
            }
        } else {
            prototypePreviewUrl.value = '';
        }
        
        // 如果没有prdId，尝试获取最新的PRD（兼容旧逻辑）
        let targetPrdId = props.prdId;
        if (!targetPrdId && prdsResponse.prds && prdsResponse.prds.length > 0) {
            // 旧API格式：prds[0].id，新API格式：prds[0].versionId
            targetPrdId = prdsResponse.prds[0].id || prdsResponse.prds[0].versionId;
        }
        
        if (targetPrdId) {
            // Avoid reloading if already loaded
            if (currentPrdId.value === targetPrdId && prdContent.value) {
                return;
            }
            
            currentPrdId.value = targetPrdId;
            
            try {
                const response: any = await apiClient.getPRD(props.projectId, targetPrdId);
                prdContent.value = response.content || response.prd?.content || '';
                
                // If editing PRD content, sync editedContent
                if (isEditing.value && isPrototypeAction.value) {
                    editedContent.value = prdContent.value;
                }
            } catch (error: any) {
                console.warn('Failed to load PRD content (may be using version-based API):', error);
                // 如果获取PRD内容失败，可能是新API格式，不显示错误
            }
        }
    } catch (error: any) {
        console.error('Failed to load PRD list:', error);
        ElMessage.warning('加载PRD列表失败');
        prdContent.value = '';
        prototypePreviewUrl.value = '';
    } finally {
        prdLoading.value = false;
    }
}

// Load prototype preview URL separately
async function loadPrototypePreviewUrl() {
    if (!props.projectId) return;
    
    try {
        const prdsResponse: any = await apiClient.getPRDs(props.projectId, false);
        
        if (prdsResponse.prds && prdsResponse.prds.length > 0) {
            // 获取第一个有prototype的版本的预览URL
            const firstVersionWithPrototype = prdsResponse.prds.find((p: any) => p.hasPrototype && p.previewUrl);
            if (firstVersionWithPrototype) {
                prototypePreviewUrl.value = firstVersionWithPrototype.previewUrl;
            } else {
                prototypePreviewUrl.value = '';
            }
        } else {
            prototypePreviewUrl.value = '';
        }
    } catch (error: any) {
        console.error('Failed to load prototype preview URL:', error);
        prototypePreviewUrl.value = '';
    }
}

async function confirmQuit() {
    try {
        await ElMessageBox.confirm(
            '确定要退出吗？当前进度会被保存，您可以稍后继续。',
            '确认退出',
            { confirmButtonText: '确定退出', cancelButtonText: '取消', type: 'warning' }
        );
        emit('action', 'quit');
    } catch { /* User cancelled */ }
}

async function downloadZip() {
    if (!zipPath.value || !props.projectId) {
        ElMessage.error('压缩包路径或项目ID不存在');
        return;
    }
    try {
        await apiClient.downloadZip(props.projectId, zipPath.value);
        ElMessage.success('压缩包下载已开始');
    } catch (error: any) {
        ElMessage.error('下载失败: ' + (error.message || '未知错误'));
    }
}

// Keyboard shortcuts
function handleKeyPress(event: KeyboardEvent) {
    if (isEditing.value) return;
    const key = event.key.toLowerCase();
    const actions: Record<string, () => void> = {
        'c': () => handleAction('continue'),
        'e': startEdit,
        'r': () => handleAction('regenerate'),
        's': () => handleAction('skip'),
        'q': confirmQuit,
    };
    actions[key]?.();
}

onMounted(async () => {
    await roleActionStore.fetchRolesAndActions();
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

.role-action-description {
    margin-top: 8px;
    padding: 8px 12px;
    background: #f0f9ff;
    border-radius: 4px;
    border-left: 3px solid #409EFF;
}

.role-action-description .description-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 6px;
}

.role-action-description .description-item:last-child {
    margin-bottom: 0;
}

.role-action-description .description-item .el-icon {
    color: #409EFF;
    margin-top: 2px;
    flex-shrink: 0;
}

.role-action-description .description-text {
    color: #303133;
    line-height: 1.5;
    font-size: 13px;
    flex: 1;
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

.zip-download-section {
    margin-bottom: 16px;
}

.zip-info {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
}

.zip-info span {
    flex: 1;
}

.error-message p {
    margin: 4px 0;
}

/* Prototype layout styles */
.prototype-layout {
    margin-top: 16px;
}

.prd-content-section {
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    padding: 16px;
    height: 600px;
    display: flex;
    flex-direction: column;
    background-color: var(--el-bg-color-page);
}

.prd-content-section .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--el-border-color);
}

.prd-content-section .section-header h4 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
}

.prd-scrollbar {
    flex: 1;
    min-height: 0;
    background: var(--el-bg-color);
    border-radius: 4px;
    padding: 12px;
}

.prd-content-display {
    height: 100%;
}

.prd-content-display .content-text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 13px;
    line-height: 1.6;
    color: var(--el-text-color-primary);
}

.loading-container,
.empty-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 40px;
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

    .prototype-layout .el-col {
        margin-bottom: 16px;
    }
}
</style>
