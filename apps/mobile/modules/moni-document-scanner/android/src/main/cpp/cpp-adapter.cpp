#include <jni.h>
#include "monidocumentscannerOnLoad.hpp"

#include <fbjni/fbjni.h>

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::monidocumentscanner::registerAllNatives();
  });
}
