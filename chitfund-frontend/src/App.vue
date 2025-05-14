<script lang="ts" setup>
import { defineComponent as _defineComponent } from "vue";
import NavBar from "./components/home/NavBar.vue"
</script>

<template>
  <div id="app">
    <NavBar />
    <main>
      <router-view></router-view>
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  min-height: 100vh;
  overflow-x: hidden;
}

#app {
  font-family: Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  min-height: 100vh;
  background-color: #f5f5f5;
  width: 100%;
  display: flex;
  flex-direction: column;
}

main {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  flex: 1;
}

/* Responsive breakpoints */
@media (max-width: 1200px) {
  main {
    max-width: 100%;
    padding: 1.5rem;
  }
}

@media (max-width: 768px) {
  main {
    padding: 1rem;
  }
}

@media (max-width: 480px) {
  main {
    padding: 0.75rem;
  }
}
</style>
