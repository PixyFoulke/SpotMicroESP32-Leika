<script lang="ts">
  import SettingsCard from '$lib/components/SettingsCard.svelte'
  import Spinner from '$lib/components/Spinner.svelte'
  import Folder from './Folder.svelte'
  import { api } from '$lib/api'
  import type { Directory } from '$lib/types/models'
  import { FolderIcon } from '$lib/components/icons'

  let filename = $state('')

  const getFiles = async () => {
    const result = await api.get<Directory>('/api/files')
    if (result.isOk()) {
      return result.inner
    }
    return { root: {} }
  }

  const getContent = async (name: string) => {
    if (!name) return ''
    const result = await api.get(`/api/config/${name}`)
    if (result.isOk()) {
      return JSON.stringify(result.inner, null, 4)
    }
    return ''
  }

  const deleteFile = async (name: string) => {
    const result = await api.post(`/api/files/delete`, { file: '/config/' + name })
    if (result.isOk()) {
      return result.inner
    }
    return ''
  }

  const updateSelected = async (name: string) => {
    filename = name
  }
</script>

<SettingsCard collapsible={false}>
  {#snippet icon()}
    <FolderIcon class="flex-shrink-0 mr-2 h-6 w-6 self-end" />
  {/snippet}
  {#snippet title()}
    <span>File System</span>
  {/snippet}
  <div class="w-full overflow-x-auto">
    {#await getFiles()}
      <Spinner />
    {:then files}
      <Folder name="/" files={files.root} expanded selected={updateSelected} />
    {/await}

    {#await getContent(filename)}
      <div>
        <Spinner />
      </div>
    {:then content}
      <pre>{content}</pre>
    {/await}
  </div>
</SettingsCard>
