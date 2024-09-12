/**
 * @desc 公共方法
 * @author changz
 * */ 

// 根据文件名判断是否是图片
export function isImage(filename) {
  // 将文件名转换为小写以忽略大小写差异
  filename = filename.toLowerCase();

  // 定义图片文件的后缀名集合
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'ico'];

  // 获取文件的后缀名
  const extension = filename.substring(filename.lastIndexOf('.') + 1);

  // 判断后缀名是否在图片文件的后缀名集合中
  return imageExtensions.includes(extension);
}