<script lang="ts">
  interface Props {
    imageUrl: string;
  }

  let { imageUrl }: Props = $props();
</script>

<div class="calendar-background-wall" aria-hidden="true">
  {#if imageUrl}
    <div class="calendar-background-wall__image" style={`background-image: url('${imageUrl}');`}></div>
    <div class="calendar-background-wall__veil"></div>
    <div class="calendar-background-wall__mist"></div>
  {/if}
</div>
